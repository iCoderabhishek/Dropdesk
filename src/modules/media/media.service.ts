import {
    GetObjectCommand,
    HeadObjectCommand,
    DeleteObjectCommand,
    CreateMultipartUploadCommand,
    UploadPartCommand,
    CompleteMultipartUploadCommand,
    ListPartsCommand,

} from "@aws-sdk/client-s3";
{ ListPartsCommand }
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { randomUUID } from "crypto";
import { prisma } from "../../infrastructure/db";
import type { Request, Response } from "express";
import { CacheService, CacheKeys } from "../../infrastructure/redis/cache.service";
import { thumbnailQueue } from "../../infrastructure/queue/thumbnails";
import { BUCKET, s3 } from "../../infrastructure/s3";
import { WORKSPACE_QUOTA_BYTES } from "../../config/env";
import { audit } from "../../core/lib/audit";
import logger from "../../infrastructure/logger"

const ALLOWED = new Set([
    "image/png",
    "image/jpeg",
    "image/webp",
    "application/pdf",
    "video/mp4",
]);

const MAX_MULTIPART_BYTES = 5 * 1024 * 1024 * 1024; // 5GB

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
        const { fileName, mimeType, size, replaceFileId, totalParts, folderId } = req.body as {
            fileName?: string;
            mimeType?: string;
            size?: number;
            replaceFileId?: string;
            totalParts?: number;
            folderId?: string;
        };

        if (!fileName || !mimeType || typeof size !== "number")
            return res
                .status(400)
                .json({ error: "fileName, mimeType, size are required" });
        if (!ALLOWED.has(mimeType))
            return res.status(415).json({ error: "Unsupported file type" });

        // Calculate a safe default parts count using 5MB chunks
        const partsCount = typeof totalParts === "number" && totalParts > 0
            ? totalParts
            : Math.ceil(size / (5 * 1024 * 1024)) || 1;

        if (size <= 0 || size > MAX_MULTIPART_BYTES)
            return res.status(413).json({ error: "File too large" });
        if (partsCount <= 0 || partsCount > 10000)
            return res.status(400).json({ error: "Invalid totalParts" });

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
                        folderId: folderId || null,
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
            metadata: { filename: fileName, size: size.toString(), multipart: true },
        });

        // Start multipart upload in S3
        const createMultipartUploadCmd = new CreateMultipartUploadCommand({
            Bucket: BUCKET,
            Key: s3Key,
            ContentType: mimeType,
        });
        const multipartUpload = await s3.send(createMultipartUploadCmd);
        const uploadId = multipartUpload.UploadId;

        if (!uploadId) {
            throw new Error("Failed to initialize multipart upload with S3");
        }

        // Generate presigned URLs for each part
        const urls = await Promise.all(
            Array.from({ length: partsCount }).map(async (num, index) => {
                const partNumber = index + 1;
                const uploadPartCmd = new UploadPartCommand({
                    Bucket: BUCKET,
                    Key: s3Key,
                    UploadId: uploadId,
                    PartNumber: partNumber,
                });
                return await getSignedUrl(s3, uploadPartCmd, { expiresIn: 3600 }); // 1 hour for large files
            })
        );

        return res.status(201).json({
            fileId: fileIdToReturn,
            uploadId,
            key: s3Key,
            urls, // Return array of pre-signed urls
        });
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
        const { uploadId, parts } = req.body as {
            uploadId: string;
            parts: { PartNumber: number; ETag: string }[];
        };

        if (!uploadId || !Array.isArray(parts) || parts.length === 0) {
            return res.status(400).json({ error: "uploadId and parts are required" });
        }

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
        // Complete the multipart upload
        try {
            // S3 expects parts to be sorted by PartNumber
            let sortedParts = parts?.sort((a, b) => a.PartNumber - b.PartNumber) || [];

            // If the frontend couldn't read ETag due to CORS, fetch parts from S3
            if (sortedParts.length === 0 || !sortedParts[0]?.ETag) {
                const listPartsRes: any = await s3.send(
                    new ListPartsCommand({
                        Bucket: BUCKET,
                        Key: file.s3Key,
                        UploadId: uploadId,
                    })
                );
                if (listPartsRes.Parts) {
                    sortedParts = listPartsRes.Parts.map((p: any) => ({
                        PartNumber: p.PartNumber,
                        ETag: p.ETag
                    }));
                }
            }

            await s3.send(
                new CompleteMultipartUploadCommand({
                    Bucket: BUCKET,
                    Key: file.s3Key,
                    UploadId: uploadId,
                    MultipartUpload: { Parts: sortedParts },
                })
            );
        } catch (err: any) {
            logger.info("CompleteMultipartUploadCommand error", err);
            return res.status(400).json({ error: "Failed to complete multipart upload", details: err.message });
        }

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
        await CacheService.clearWorkspaceFiles(workspaceId as string);

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

        const page = parseInt(req.query.page as string) || 1;
        const limit = parseInt(req.query.limit as string) || 50;
        const skip = (page - 1) * limit;

        const folderId = req.query.folderId as string | undefined;
        const cachedKey = CacheKeys.workspaceFiles(workspaceId);

        if (!folderId && page === 1 && limit === 50) {
            const cachedData = await CacheService.get<any>(cachedKey);
            if (cachedData) return res.status(200).json(cachedData);
        }

        const whereClause: any = { workspaceId, status: "READY", deletedAt: null };
        if (folderId !== undefined) {
            whereClause.folderId = folderId === "null" ? null : folderId;
        }

        const [total, files] = await prisma.$transaction([
            prisma.files.count({
                where: whereClause,
            }),
            prisma.files.findMany({
                where: whereClause,
                include: { uploader: true },
                skip,
                take: limit,
            })
        ]);

        // Convert BigInt to String to prevent JSON.stringify from crashing..
        const safeFiles = files.map((file) => ({
            ...file,
            size: file.size?.toString(),
        }));

        const responseData = {
            files: safeFiles,
            pagination: {
                total,
                page,
                limit,
                totalPages: Math.ceil(total / limit),
            }
        };

        // We only cache the first page to keep invalidation simple
        if (!folderId && page === 1 && limit === 50) {
            await CacheService.set(cachedKey, responseData, 60 * 15);
        }
        return res.status(200).json(responseData);
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
        logger.info("error", error);
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
        await CacheService.clearWorkspaceFiles(workspaceId as string);
        await CacheService.clearWorkspaceTrashed(workspaceId as string);
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
        await CacheService.clearWorkspaceFiles(workspaceId as string);
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
        await CacheService.set(CacheKeys.workspaceTrashed(workspaceId as string), safeFiles, 60 * 15);
        return res.status(200).json({ files: safeFiles });
    } catch (error) {
        logger.info(error);
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
        await CacheService.clearWorkspaceFiles(workspaceId as string);
        await CacheService.clearWorkspaceTrashed(workspaceId as string);
        return res
            .status(200)
            .json({
                success: true,
                file: { ...updatedFile, size: updatedFile.size?.toString() },
            });
    } catch (error) {
        logger.info(error);
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
        await prisma.fileVersion.deleteMany({
            where: { fileId },
        });
        const updatedFile = await prisma.files.delete({
            where: { id: fileId },
        });

        // NOW we can permanently delete from S3
        try {
            await s3.send(new DeleteObjectCommand({ Bucket: BUCKET, Key: trashedFile.s3Key }));
            if (trashedFile.thumbnailS3Key) {
                await s3.send(new DeleteObjectCommand({ Bucket: BUCKET, Key: trashedFile.thumbnailS3Key }));
            }
        } catch (s3Error) {
            logger.error("Failed to delete object from S3 during trashbin empty", s3Error);
        }

        try {
            await audit({
                workspaceId: workspaceId!,
                actorId: userId,
                action: "DELETE",
                targetType: "FILE",
                targetId: updatedFile.id,
                metadata: { filename: updatedFile.name },
            });
        } catch (auditErr) {
            logger.error("Failed to audit file deletion", auditErr);
        }
        // Invalidate cache since file properties changed
        await CacheService.clearWorkspaceFiles(workspaceId as string);
        await CacheService.clearWorkspaceTrashed(workspaceId as string);
        return res
            .status(200)
            .json({
                success: true,
                file: { ...updatedFile, size: updatedFile.size?.toString() },
            });
    } catch (error) {
        logger.info(error);
        return res.status(500).json({ error: "Error deleting file from trashbin" });
    }
};

export const searchFiles = async (req: Request, res: Response) => {
    try {
        const userId = req.user?.userId;
        if (!userId) return res.status(401).json({ error: "Unauthorized" });

        const workspaceId = req.params.workspaceId as string;

        const page = parseInt(req.query.page as string) || 1;
        const limit = parseInt(req.query.limit as string) || 50;
        const skip = (page - 1) * limit;

        const q = req.query.q as string;
        const type = req.query.type as string;
        const minSize = req.query.minSize ? BigInt(req.query.minSize as string) : undefined;
        const maxSize = req.query.maxSize ? BigInt(req.query.maxSize as string) : undefined;
        const uploaderId = req.query.uploaderId as string;
        const dateFrom = req.query.dateFrom ? new Date(req.query.dateFrom as string) : undefined;
        const dateTo = req.query.dateTo ? new Date(req.query.dateTo as string) : undefined;
        const isPublicStr = req.query.isPublic as string;

        let isPublic: boolean | undefined = undefined;
        if (isPublicStr === "true") isPublic = true;
        if (isPublicStr === "false") isPublic = false;

        const whereClause: any = {
            workspaceId,
            status: "READY",
            deletedAt: null,
        };

        if (q) {
            // For filenames, substring matching (ILIKE) is much better than Full-Text Search.
            // Full-Text Search strips dots (like .jpg) and only matches exact word stems.
            whereClause.name = { contains: q.trim(), mode: "insensitive" };
        }
        if (type) {
            whereClause.mimetype = { startsWith: type };
        }
        if (uploaderId) {
            whereClause.uploaderId = uploaderId;
        }
        if (isPublic !== undefined) {
            whereClause.isPublic = isPublic;
        }
        if (minSize || maxSize) {
            whereClause.size = {};
            if (minSize) whereClause.size.gte = minSize;
            if (maxSize) whereClause.size.lte = maxSize;
        }
        if (dateFrom || dateTo) {
            whereClause.createdAt = {};
            if (dateFrom) whereClause.createdAt.gte = dateFrom;
            if (dateTo) whereClause.createdAt.lte = dateTo;
        }

        const [total, files] = await prisma.$transaction([
            prisma.files.count({ where: whereClause }),
            prisma.files.findMany({
                where: whereClause,
                include: { uploader: true },
                skip,
                take: limit,
                orderBy: { createdAt: 'desc' },
            })
        ]);

        const safeFiles = files.map((file) => ({
            ...file,
            size: file.size?.toString(),
        }));

        const responseData = {
            files: safeFiles,
            pagination: {
                total,
                page,
                limit,
                totalPages: Math.ceil(total / limit),
            }
        };

        return res.status(200).json(responseData);
    } catch (error) {
        logger.info("Error searching files", error);
        return res.status(500).json({ error: "Error searching files" });
    }
};

export const moveFile = async (req: Request, res: Response) => {
    try {
        const { folderId } = req.body;
        const workspaceId = req.params.workspaceId as string;
        const fileId = req.params.fileId as string;
        const userId = req.user?.userId;

        if (!userId) return res.status(401).json({ error: "Unauthorized" });

        const existingFile = await prisma.files.findFirst({
            where: { id: fileId, workspaceId }
        });
        if (!existingFile) return res.status(404).json({ error: "File not found" });

        const file = await prisma.files.update({
            where: { id: fileId },
            data: { folderId: folderId || null },
        });

        await CacheService.clearWorkspaceFiles(workspaceId as string);

        await audit({
            workspaceId,
            actorId: userId,
            action: "MOVE",
            targetType: "FILE",
            targetId: file.id,
            metadata: { newFolderId: folderId },
        });

        return res.status(200).json({ 
            success: true, 
            file: { ...file, size: file.size?.toString() } 
        });
    } catch (error) {
        logger.error("Error moving file:", error);
        return res.status(500).json({ error: "Error moving file" });
    }
};
