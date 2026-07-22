import { PutObjectCommand, GetObjectCommand, HeadObjectCommand, DeleteObjectCommand } from "@aws-sdk/client-s3"
import { getSignedUrl } from "@aws-sdk/s3-request-presigner"
import { randomUUID } from "crypto"
import { prisma } from "../../infrastructure/db"
import type { Request, Response } from "express"
import { redis } from "../../infrastructure/redis/redis"
import { thumbnailQueue } from "../../infrastructure/queue/thumbnails"
import { BUCKET, s3 } from "../../infrastructure/s3"


const ALLOWED = new Set(["image/png", "image/jpeg", "image/webp", "application/pdf", "video/mp4"])
const MAX_BYTES = 100 * 1024 * 1024

export const requestUpload = async (req: Request, res: Response) => {
    try {
        const userId = req.user?.userId
        if (!userId) return res.status(401).json({ error: "Unauthorized" })

        const workspaceId = req.params.workspaceId as string
        const { fileName, mimeType, size } = req.body as {
            fileName?: string; mimeType?: string; size?: number
        }

        if (!fileName || !mimeType || typeof size !== "number")
            return res.status(400).json({ error: "fileName, mimeType, size are required" })
        if (!ALLOWED.has(mimeType)) return res.status(415).json({ error: "Unsupported file type" })
        if (size <= 0 || size > MAX_BYTES)
            return res.status(413).json({ error: "File too large" })

        const member = await prisma.memberships.findFirst({ where: { workspaceId, userId } })
        if (!member) return res.status(404).json({ error: "Workspace not found" })

        const key = `workspaces/${workspaceId}/${randomUUID()}/${encodeURIComponent(fileName)}`

        const file = await prisma.files.create({
            data: {
                workspaceId,
                uploaderId: userId,
                name: fileName,
                mimetype: mimeType,
                size: BigInt(size),
                s3Key: key,

            },
        })

        const uploadUrl = await getSignedUrl(
            s3,
            new PutObjectCommand({ Bucket: BUCKET, Key: key, ContentType: mimeType }),
            { expiresIn: 300 }
        )

        return res.status(201).json({ fileId: file.id, uploadUrl, key })
    } catch {
        return res.status(500).json({ error: "Error creating upload" })
    }
}




export const confirmUpload = async (req: Request, res: Response) => {
    try {
        const userId = req.user?.userId
        if (!userId) return res.status(401).json({ error: "Unauthorized" })

        const { workspaceId, fileId } = req.params as Record<string, string>

        const file = await prisma.files.findFirst({
            where: {
                id: fileId,
                workspaceId,
                workspace: { memberships: { some: { userId } } },
            },
        })
        if (!file) return res.status(404).json({ error: "File not found" })
        if (file.status === "READY") return res.status(200).json({ file: { ...file, size: file.size?.toString() } })

        let head
        try {
            head = await s3.send(new HeadObjectCommand({ Bucket: BUCKET, Key: file.s3Key }))
        } catch {
            return res.status(409).json({ error: "Object not uploaded" })
        }

        const updated = await prisma.files.update({
            where: { id: fileId },
            data: { status: "READY", size: BigInt(head.ContentLength ?? Number(file.size)) },
        })
        // img gen queue

        const IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp"];
        if (file.mimetype && IMAGE_TYPES.includes(file.mimetype)) {
            await thumbnailQueue.add(
                "generate",
                { fileId: file.id },
                { attempts: 3, backoff: { type: "exponential", delay: 2000 }, removeOnComplete: true }
            );
        }

        // INVALIDATION: A new file was added! Erase the stale cache so the next GET fetches fresh data.
        await redis.del(`ws:${workspaceId}:files`)

        return res.status(200).json({ file: { ...updated, size: updated.size?.toString() } })
    } catch {
        return res.status(500).json({ error: "Error confirming upload" })
    }
}


export const getAllFiles = async (req: Request, res: Response) => {
    try {
        const userId = req.user?.userId
        if (!userId) return res.status(401).json({ error: "Unauthorized" })

        const workspaceId = req.params.workspaceId as string
        const cachedKey = `ws:${workspaceId}:files`
        const cachedData = await redis.get(cachedKey)
        if (cachedData) return res.status(200).json(JSON.parse(cachedData))

        const files = await prisma.files.findMany({
            where: { workspaceId },
            include: { uploader: true },
        })

        // Convert BigInt to String to prevent JSON.stringify from crashing..
        const safeFiles = files.map(file => ({
            ...file,
            size: file.size?.toString()
        }))

        await redis.set(cachedKey, JSON.stringify(safeFiles), "EX", 60 * 15)
        return res.status(200).json({ files: safeFiles })
    } catch {
        return res.status(500).json({ error: "Error getting files" })
    }
}


export const getDownloadUrl = async (req: Request, res: Response) => {
    const userId = req.user?.userId
    if (!userId) return res.status(401).json({ error: "Unauthorized" })

    const { workspaceId, fileId } = req.params as Record<string, string>
    const file = await prisma.files.findFirst({
        where: { id: fileId, workspaceId, status: "READY", workspace: { memberships: { some: { userId } } } },
    })
    if (!file) return res.status(404).json({ error: "File not found" })

    const action = req.query.action as string
    // If action=download, force download. Otherwise, preview it inline in the browser.
    const disposition = action === "download"
        ? `attachment; filename="${file.name}"`
        : `inline; filename="${file.name}"`

    const url = await getSignedUrl(
        s3,
        new GetObjectCommand({ Bucket: BUCKET, Key: file.s3Key, ResponseContentDisposition: disposition, ResponseContentType: file.mimetype ?? undefined }),
        { expiresIn: 300 }
    )
    return res.status(200).json({ url })
}



export const streamPublicProxyHandler = async (req: Request, res: Response) => {
    try {
        const fileId = req.params.fileId as string;
        const file = await prisma.files.findFirst({
            where: { id: fileId, isPublic: true },
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
        if (obj.ContentLength) res.setHeader("Content-Length", obj.ContentLength.toString());
        res.setHeader("Accept-Ranges", "bytes");

        // Prefer our DB mimetype if available, because S3 might wrongly default to application/octet-stream
        const contentType = (file.mimetype && file.mimetype !== "application/octet-stream")
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
        res.status(500).json({ error: "Error streaming file", details: error.message || String(error) });
    }
}

export const deleteFile = async (req: Request, res: Response) => {
    try {
        const userId = req.user?.userId
        if (!userId) return res.status(401).json({ error: "Unauthorized" })

        const { workspaceId, fileId } = req.params as Record<string, string>
        const file = await prisma.files.findFirst({
            where: { id: fileId, workspaceId, workspace: { memberships: { some: { userId } } } },
        })
        if (!file) return res.status(404).json({ error: "File not found" })

        // delete from s3 and db
        // ideally i should just do soft deletes like files.upsert{deleted: true} for audit purpose, but here removing from s3 object saving me some storage cost
        await s3.send(new DeleteObjectCommand({ Bucket: BUCKET, Key: file.s3Key }))
        await prisma.files.delete({ where: { id: fileId } })

        await redis.del(`ws:${workspaceId}:files`)
        return res.status(200).json({ success: true })
    } catch (error) {
        res.status(500).json({ error: "Error deleting file" })
    }
}

export const togglePublicStatus = async (req: Request, res: Response) => {
    try {
        const userId = req.user?.userId;
        if (!userId) return res.status(401).json({ error: "Unauthorized" });

        const { workspaceId, fileId } = req.params as Record<string, string>;
        const { isPublic } = req.body as { isPublic: boolean };

        if (typeof isPublic !== "boolean") return res.status(400).json({ error: "isPublic must be boolean" });

        const file = await prisma.files.findFirst({
            where: { id: fileId, workspaceId, workspace: { memberships: { some: { userId } } } },
        });
        if (!file) return res.status(404).json({ error: "File not found" });

        const updatedFile = await prisma.files.update({
            where: { id: fileId },
            data: { isPublic },
        });

        // Invalidate cache since file properties changed
        await redis.del(`ws:${workspaceId}:files`);
        return res.status(200).json({ success: true, file: { ...updatedFile, size: updatedFile.size?.toString() } });
    } catch (error) {
        return res.status(500).json({ error: "Error updating file" });
    }
}

// todo: move to trash bin feature - soft delete file from db and not s3 objects, maybe set a cron job to delete all trashed files after 30 days