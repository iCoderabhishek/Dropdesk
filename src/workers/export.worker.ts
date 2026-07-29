import { Worker } from "bullmq";
import { S3Client, GetObjectCommand } from "@aws-sdk/client-s3";
import { Upload } from "@aws-sdk/lib-storage";
import { PassThrough, Readable } from "stream";
import { prisma } from "../infrastructure/db";
import { redis } from "../infrastructure/redis/redis";
import { S3_REGION, S3_BUCKET } from "../config/env";
import { createArchiver } from "../infrastructure/archiver";
import logger from "../infrastructure/logger"

const s3 = new S3Client({
    region: S3_REGION,
    requestChecksumCalculation: "WHEN_REQUIRED",
});

export const exportWorker = new Worker(
    "export",
    async (job) => {
        const { jobId } = job.data as { jobId: string };
        // this export job that ive build needs few steps, i am writing them:

        // 1. Mark job as processing
        await prisma.exportJobs.update({
            where: { id: jobId },
            data: { status: "PROCESSING" },
        });

        // 2. Fetch the job to get the file IDs
        const exportJob = await prisma.exportJobs.findUnique({
            where: { id: jobId },
        });
        if (!exportJob || exportJob.fileIds.length === 0) return;

        // 3. Fetch the file metadata
        const files = await prisma.files.findMany({
            where: { id: { in: exportJob.fileIds } },
        });

        if (files.length === 0) {
            await prisma.exportJobs.update({
                where: { id: jobId },
                data: { status: "FAILED" },
            });
            throw new Error("No valid files found for export");
        }

        // 4. Setup Archiver and Stream to S3
        const zipKey = `exports/${jobId}.zip`;
        const passThrough = new PassThrough();

        // i should have build this as a config, but one liner its fine
        const zip = createArchiver();

        const upload = new Upload({
            client: s3,
            params: {
                Bucket: S3_BUCKET,
                Key: zipKey,
                Body: passThrough,
                ContentType: "application/zip",
            },
        });

        // Pipe archiver data to our passthrough stream which goes to S3
        zip.pipe(passThrough);

        // 5. Download each file and append to zip
        for (const file of files) {
            try {
                const getObj = await s3.send(
                    new GetObjectCommand({ Bucket: S3_BUCKET, Key: file.s3Key })
                );

                if (getObj.Body) {
                    // aws-sdk v3 Body is a stream in Node/Bun
                    zip.append(getObj.Body as Readable, { name: file.name });
                }
            } catch (error) {
                logger.error(`Failed to fetch file ${file.name} for zip:`, error);
                // We'll skip failed files rather than failing the whole zip
            }
        }

        // Finalize the zip and wait for S3 upload to complete
        await zip.finalize();
        await upload.done();

        // 6. Mark job as done
        await prisma.exportJobs.update({
            where: { id: jobId },
            data: {
                status: "DONE",
                zipS3Key: zipKey
            },
        });
    },
    { connection: redis }
);

exportWorker.on('failed', async (job, err) => {
    if (job) {
        logger.error(`Job ${job.id} failed:`, err);
        await prisma.exportJobs.update({
            where: { id: job.data.jobId },
            data: { status: "FAILED" },
        });
    }
});
