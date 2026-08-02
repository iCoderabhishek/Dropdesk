import { Worker } from "bullmq";
import sharp from "sharp";
import { GetObjectCommand, PutObjectCommand } from "@aws-sdk/client-s3";
import { redis } from "../infrastructure/redis/redis";
import { CacheService } from "../infrastructure/redis/cache.service";
import { prisma } from "../infrastructure/db";
import { s3, BUCKET } from "../infrastructure/s3"
import logger from "../infrastructure/logger"


export const thumbnailWorker = new Worker(
    "thumbnails",
    async (job) => {
        const { fileId } = job.data as { fileId: string };
        const file = await prisma.files.findUnique({ where: { id: fileId } });
        if (!file) return; // deleted before we got to it — nothing to do.

        // 1. Pull the original bytes into a buffer (thumbnails are small work).
        const obj = await s3.send(new GetObjectCommand({ Bucket: BUCKET, Key: file.s3Key }));
        const input = Buffer.from(await obj.Body!.transformToByteArray());

        // 2. Resize: fit inside 300x300, never upscale, output webp.
        const output = await sharp(input)
            .autoOrient()
            .resize(300, 300, { fit: "inside", withoutEnlargement: true })
            .webp({ quality: 80 })
            .toBuffer();

        // 3. Store alongside the original under a predictable key.
        const thumbKey = `${file.workspaceId}/thumbs/${file.id}.webp`;
        await s3.send(new PutObjectCommand({
            Bucket: BUCKET, Key: thumbKey, Body: output, ContentType: "image/webp",
        }));

        // 4. Record it and bust the workspace file cache so the thumb shows up.
        await prisma.files.update({ where: { id: file.id }, data: { thumbnailS3Key: thumbKey } });
        await CacheService.clearWorkspaceFiles(file.workspaceId);
    },
    { connection: redis }
);

thumbnailWorker.on('failed', async (job, err) => {
    if (job) {
        logger.error(`Job ${job.id} failed:`, err);
        await prisma.exportJobs.update({
            where: { id: job.data.fileId },
            data: { status: "FAILED" },
        });
    }
});
