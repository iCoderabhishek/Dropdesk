import {
    PutObjectCommand,
    GetObjectCommand,
    HeadObjectCommand,
    DeleteObjectCommand,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { randomUUID } from "crypto";
import { prisma } from "../../infrastructure/db";
import type { Request, Response } from "express";
import { redis } from "../../infrastructure/redis/redis";
import { thumbnailQueue } from "../../infrastructure/queue/thumbnails";
import { BUCKET, s3 } from "../../infrastructure/s3";
import { WORKSPACE_QUOTA_BYTES } from "../../config/env";
import { audit } from "../../core/lib/audit";

const ALLOWED = new Set([
    "image/png",
    "image/jpeg",
    "image/webp",
    "application/pdf",
    "video/mp4",
]);
const MAX_BYTES = 100 * 1024 * 1024;

async function assertWithinQuota(workspaceId: string, incomingSize: bigint) {
    const agg = await prisma.files.aggregate({
        where: { workspaceId },
        _sum: { size: true },
    });
    const used = agg._sum.size ?? 0n; // BigInt | null
    if (used + incomingSize > WORKSPACE_QUOTA_BYTES) {
        const err: any = new Error("workspace storage quota exceeded");
        err.status = 413; // Payload Too Large
        err.used = used.toString();
        err.limit = WORKSPACE_QUOTA_BYTES.toString();
        throw err;
    }
}

export const requestUpload = async (req: Request, res: Response) => {
    try {
        const userId = req.user?.userId;
        if (!userId) return res.status(401).json({ error: "Unauthorized" });

        const workspaceId = req.params.workspaceId as string;
        const { fileName, mimeType, size, replaceFileId } = req.body as {
            fileName?: string;
            mimeType?: string;
            size?: number;
            replaceFileId?: string;
        };

        if (!fileName || !mimeType || typeof size !== "number")
            return res
                .status(400)
                .json({ error: "fileName, mimeType, size are required" });
        if (!ALLOWED.has(mimeType))
            return res.status(415).json({ error: "Unsupported file type" });
        if (size <= 0 || size > MAX_BYTES)
            return res.status(413).json({ error: "File too large" });

        const member = await prisma.memberships.findFirst({
            where: { workspaceId, userId },
        });
        if (!member) return res.status(404).json({ error: "Workspace not found" });

        // presignHandler — reject early so the browser never wastes an upload.
        await assertWithinQuota(workspaceId, BigInt(size));

        let fileIdToReturn: string;
        let s3Key: string;
        let targetFileId = replaceFileId;

        // Auto-detect existing file by name if replaceFileId wasn't explicitly provided
        if (!targetFileId) {
            const existingFileByName = await prisma.files.findFirst({
                where: {
                    workspaceId,
                    name: fileName,
                    deletedAt: null, // Only consider active files, not trash
                },
            });
            if (existingFileByName) {
                targetFileId = existingFileByName.id;
            }
        }

        if (targetFileId) {
            // Handle File Replacement (Versioning)
            const existingFile = await prisma.files.findFirst({
                where: {
                    id: targetFileId,
                    workspaceId,
                    workspace: { memberships: { some: { userId } } },
                },
            });
            if (!existingFile) return res.status(404).json({ error: "File to replace not found" });

            const nextVersion = (await prisma.fileVersion.count({ where: { fileId: targetFileId } })) + 1;
            s3Key = `workspaces/${workspaceId}/${targetFileId}/v${nextVersion}-${encodeURIComponent(fileName)}`;
            fileIdToReturn = targetFileId;

            await prisma.$transaction([
                prisma.files.update({
                    where: { id: targetFileId },
                    data: {
                        s3Key,
                        size: BigInt(size),
                        name: fileName,
                        mimetype: mimeType,
                        status: "PENDING",
                    },
                }),
                prisma.fileVersion.create({
                    data: {
                        fileId: targetFileId,
                        version: nextVersion,
                        s3Key,
                        size: BigInt(size),
                        createdBy: userId,
                    },
                }),
            ]);
        } else {
            // Handle New File Upload
            s3Key = `workspaces/${workspaceId}/${randomUUID()}/${encodeURIComponent(fileName)}`;

            const newFile = await prisma.$transaction(async (tx) => {
                const createdFile = await tx.files.create({
                    data: {
                        workspaceId,
                        uploaderId: userId,
                        name: fileName,
                        mimetype: mimeType,
                        size: BigInt(size),
                        s3Key,
                    },
                });

                await tx.fileVersion.create({
                    data: {
                        fileId: createdFile.id,
                        version: 1,
                        s3Key,
                        size: BigInt(size),
                        createdBy: userId,
                    },
                });

                return createdFile;
            });

            fileIdToReturn = newFile.id;
        }

        await audit({
            workspaceId,
            actorId: userId,
            action: replaceFileId ? "UPDATE" : "UPLOAD",
            targetType: "FILE",
            targetId: fileIdToReturn,
            metadata: { filename: fileName, size: size.toString() },
        });

        const uploadUrl = await getSignedUrl(
            s3,
            new PutObjectCommand({ Bucket: BUCKET, Key: s3Key, ContentType: mimeType }),
            { expiresIn: 300 },
        );

        return res.status(201).json({ fileId: fileIdToReturn, uploadUrl, key: s3Key });
    } catch (err: any) {
        if (err?.status === 413) {
            return res
                .status(413)
                .json({ error: err.message, used: err.used, limit: err.limit });
        }
        return res.status(500).json({ error: "Error processing upload request" });
    }
};

export const confirmUpload = async (req: Request, res: Response) => {
    try {
        const userId = req.user?.userId;
        if (!userId) return res.status(401).json({ error: "Unauthorized" });

        const { workspaceId, fileId } = req.params as Record<string, string>;

        const file = await prisma.files.findFirst({
            where: {
                id: fileId,
                workspaceId,
                workspace: { memberships: { some: { userId } } },
            },
        });
        if (!file) return res.status(404).json({ error: "File not found" });
        if (file.status === "READY")
            return res
                .status(200)
                .json({ file: { ...file, size: file.size?.toString() } });

        let head;
        try {
            head = await s3.send(
                new HeadObjectCommand({ Bucket: BUCKET, Key: file.s3Key }),
            );
        } catch {
            return res.status(409).json({ error: "Object not uploaded" });
        }

        const updated = await prisma.files.update({
            where: { id: fileId },
            data: {
                status: "READY",
                size: BigInt(head.ContentLength ?? Number(file.size)),
            },
        });
        // img gen queue

        const IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp"];
        if (file.mimetype && IMAGE_TYPES.includes(file.mimetype)) {
            await thumbnailQueue.add(
                "generate",
                { fileId: file.id },
                {
                    attempts: 3,
                    backoff: { type: "exponential", delay: 2000 },
                    removeOnComplete: true,
                },
            );
        }

        // INVALIDATION: A new file was added! Erase the stale cache so the next GET fetches fresh data.
        await redis.del(`ws:${workspaceId}:files`);

        return res
            .status(200)
            .json({ file: { ...updated, size: updated.size?.toString() } });
    } catch {
        return res.status(500).json({ error: "Error confirming upload" });
    }
};

export const getAllFiles = async (req: Request, res: Response) => {
    try {
        const userId = req.user?.userId;
        if (!userId) return res.status(401).json({ error: "Unauthorized" });

        const workspaceId = req.params.workspaceId as string;
        const cachedKey = `ws:${workspaceId}:files`;
        const cachedData = await redis.get(cachedKey);
        if (cachedData) return res.status(200).json(JSON.parse(cachedData));

        const files = await prisma.files.findMany({
            where: { workspaceId, status: "READY", deletedAt: null },
            include: { uploader: true },
        });

        // Convert BigInt to String to prevent JSON.stringify from crashing..
        const safeFiles = files.map((file) => ({
            ...file,
            size: file.size?.toString(),
        }));

        await redis.set(cachedKey, JSON.stringify(safeFiles), "EX", 60 * 15);
        return res.status(200).json({ files: safeFiles });
    } catch {
        return res.status(500).json({ error: "Error getting files" });
    }
};

export const getDownloadUrl = async (req: Request, res: Response) => {
    const userId = req.user?.userId;
    if (!userId) return res.status(401).json({ error: "Unauthorized" });

    const { workspaceId, fileId } = req.params as Record<string, string>;
    const file = await prisma.files.findFirst({
        where: {
            id: fileId,
            workspaceId,
            status: "READY",
            deletedAt: null,
            workspace: { memberships: { some: { userId } } },
        },
    });
    if (!file) return res.status(404).json({ error: "File not found" });

    const action = req.query.action as string;
    // If action=download, force download. Otherwise, preview it inline in the browser.
    const disposition =
        action === "download"
            ? `attachment; filename="${file.name}"`
            : `inline; filename="${file.name}"`;

    const url = await getSignedUrl(
        s3,
        new GetObjectCommand({
            Bucket: BUCKET,
            Key: file.s3Key,
            ResponseContentDisposition: disposition,
            ResponseContentType: file.mimetype ?? undefined,
        }),
        { expiresIn: 300 },
    );
    return res.status(200).json({ url });
};

export const streamPublicProxyHandler = async (req: Request, res: Response) => {
    try {
        const fileId = req.params.fileId as string;
        const file = await prisma.files.findFirst({
            where: { id: fileId, isPublic: true, deletedAt: null },
        });
        if (!file) return res.status(404).end();

        // Only use range requests for videos
        const isVideo = file.mimetype?.startsWith("video/");
        const range = isVideo ? req.headers.range : undefined;

        const command = new GetObjectCommand({
            Bucket: BUCKET,
            Key: file.s3Key,
            Range: range, // undefined = fetch whole object
        });

        const obj = await s3.send(command);

        // MAKING the browser header same as s3 obj//
        res.setHeader("Content-Disposition", `inline; filename="${file.name}"`);

        if (obj.ContentRange) res.setHeader("Content-Range", obj.ContentRange);
        if (obj.ContentLength)
            res.setHeader("Content-Length", obj.ContentLength.toString());
        res.setHeader("Accept-Ranges", "bytes");

        // Prefer our DB mimetype if available, because S3 might wrongly default to application/octet-stream
        const contentType =
            file.mimetype && file.mimetype !== "application/octet-stream"
                ? file.mimetype
                : (obj.ContentType ?? "application/octet-stream");

        res.setHeader("Content-Type", contentType);
        res.status(range ? 206 : 200);

        if (obj.Body) {
            const bodyAny = obj.Body as any;
            if (typeof bodyAny.pipe === "function") {
                bodyAny.pipe(res);
            } else if (typeof bodyAny.transformToByteArray === "function") {
                // Fallback for Bun/Web streams if pipe isn't available natively
                const buffer = await bodyAny.transformToByteArray();
                res.end(Buffer.from(buffer));
            } else {
                res.end();
            }
        } else {
            res.end();
        }
    } catch (error: any) {
        console.log("error", error);
        res
            .status(500)
            .json({
                error: "Error streaming file",
                details: error.message || String(error),
            });
    }
};

export const deleteFile = async (req: Request, res: Response) => {
    try {
        const userId = req.user?.userId;
        if (!userId) return res.status(401).json({ error: "Unauthorized" });

        const { workspaceId, fileId } = req.params as Record<string, string>;
        const file = await prisma.files.findFirst({
            where: {
                id: fileId,
                workspaceId,
                deletedAt: null,
                workspace: { memberships: { some: { userId } } },
            },
        });
        if (!file) return res.status(404).json({ error: "File not found" });


        await audit({
            workspaceId: file.workspaceId,
            actorId: userId,
            action: "DELETE",
            targetType: "FILE",
            targetId: file.id,
            metadata: { filename: file.name },
        });

        await prisma.files.update({
            where: { id: fileId },
            data: { deletedAt: new Date() },
        });
        await redis.del(`ws:${workspaceId}:files`);
        await redis.del(`ws:${workspaceId}:trashed`);
        return res.status(200).json({ success: true });
    } catch (error) {
        res.status(500).json({ error: "Error deleting file" });
    }
};

export const togglePublicStatus = async (req: Request, res: Response) => {
    try {
        const userId = req.user?.userId;
        if (!userId) return res.status(401).json({ error: "Unauthorized" });

        const { workspaceId, fileId } = req.params as Record<string, string>;
        const { isPublic } = req.body as { isPublic: boolean };

        if (typeof isPublic !== "boolean")
            return res.status(400).json({ error: "isPublic must be boolean" });

        const file = await prisma.files.findFirst({
            where: {
                id: fileId,
                workspaceId,
                deletedAt: null,
                workspace: { memberships: { some: { userId } } },
            },
        });
        if (!file) return res.status(404).json({ error: "File not found" });

        const updatedFile = await prisma.files.update({
            where: { id: fileId },
            data: { isPublic },
        });

        await audit({
            workspaceId: file.workspaceId,
            actorId: userId,
            action: "UPDATE",
            targetType: "FILE",
            targetId: file.id,
            metadata: { filename: file.name, isPublic },
        });

        // Invalidate cache since file properties changed
        await redis.del(`ws:${workspaceId}:files`);
        return res
            .status(200)
            .json({
                success: true,
                file: { ...updatedFile, size: updatedFile.size?.toString() },
            });
    } catch (error) {
        return res.status(500).json({ error: "Error updating file" });
    }
};

// doing the trashbin feature

export const getTrashbin = async (req: Request, res: Response) => {
    try {
        const userId = req.user?.userId;
        if (!userId) return res.status(401).json({ error: "Unauthorized" });
        const { workspaceId } = req.params as Record<string, string>;
        const trashedFiles = await prisma.files.findMany({
            where: {
                workspaceId,
                deletedAt: { not: null },
            },
            include: { uploader: true },
        });
        // Convert BigInt to String to prevent JSON.stringify from crashing..
        const safeFiles = trashedFiles.map((file) => ({
            ...file,
            size: file.size?.toString(),
        }));
        await redis.set(
            `ws:${workspaceId}:trashed`,
            JSON.stringify(safeFiles),
            "EX",
            60 * 15,
        );
        return res.status(200).json({ files: safeFiles });
    } catch (error) {
        console.log(error);
        return res.status(500).json({ error: "Error getting trashed files" });
    }
};

export const restoreTrashbin = async (req: Request, res: Response) => {
    try {
        const userId = req.user?.userId;
        if (!userId) return res.status(401).json({ error: "Unauthorized" });
        const { workspaceId, fileId } = req.params as Record<string, string>;
        const trashedFile = await prisma.files.findFirst({
            where: {
                id: fileId,
                workspaceId,
                deletedAt: { not: null },
            },
        });
        if (!trashedFile) return res.status(404).json({ error: "File not found" });
        // for restoring, just update the deletedAt null
        const updatedFile = await prisma.files.update({
            where: { id: fileId },
            data: { deletedAt: null },
        });
        await audit({
            workspaceId: workspaceId!,
            actorId: userId,
            action: "RESTORE",
            targetType: "FILE",
            targetId: fileId,
            metadata: { filename: updatedFile.name },
        });
        // Invalidate cache since file properties changed
        await redis.del(`ws:${workspaceId}:files`);
        await redis.del(`ws:${workspaceId}:trashed`);
        return res
            .status(200)
            .json({
                success: true,
                file: { ...updatedFile, size: updatedFile.size?.toString() },
            });
    } catch (error) {
        console.log(error);
        return res.status(500).json({ error: "Error restoring file" });
    }
};

export const deleteTrashbin = async (req: Request, res: Response) => {
    try {
        const userId = req.user?.userId;
        if (!userId) return res.status(401).json({ error: "Unauthorized" });
        const { workspaceId, fileId } = req.params as Record<string, string>;
        const trashedFile = await prisma.files.findFirst({
            where: {
                id: fileId,
                workspaceId,
                deletedAt: { not: null },
            },
        });
        if (!trashedFile) return res.status(404).json({ error: "File not found" });
        // we dont store data after trashbin cleared
        const updatedFile = await prisma.files.delete({
            where: { id: fileId },
        });

        // NOW we can permanently delete from S3
        await s3.send(new DeleteObjectCommand({ Bucket: BUCKET, Key: trashedFile.s3Key }));

        await audit({
            workspaceId: workspaceId!,
            actorId: userId,
            action: "DELETE",
            targetType: "FILE",
            targetId: updatedFile.id,
            metadata: { filename: updatedFile.name },
        });
        // Invalidate cache since file properties changed
        await redis.del(`ws:${workspaceId}:files`);
        await redis.del(`ws:${workspaceId}:trashed`);
        return res
            .status(200)
            .json({
                success: true,
                file: { ...updatedFile, size: updatedFile.size?.toString() },
            });
    } catch (error) {
        console.log(error);
        return res.status(500).json({ error: "Error restoring file" });
    }
};
