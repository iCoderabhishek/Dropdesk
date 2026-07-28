import { Queue, Worker } from "bullmq";
import { redis } from "../infrastructure/redis/redis";
import { prisma } from "../infrastructure/db";
import { BUCKET, s3 } from "../infrastructure/s3";
import { DeleteObjectCommand } from "@aws-sdk/client-s3";


export const garbageCollectionQueue = new Queue(
    "garbage-collection",
    {
        connection: redis
    }
)

new Worker("garbage-collection", async () => {
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000); //30da

    const expired = await prisma.files.findMany({
        where: {
            deletedAt: {
                lt: thirtyDaysAgo
            }
        }
    })

    for (const file of expired) {
        await s3.send(new DeleteObjectCommand({
            Bucket: BUCKET, Key: file.s3Key
        }))
        await prisma.files.delete({
            where: { id: file.id }
        })
    }
}, {
    connection: redis
})

// Schedule the garbage collection job to run automatically every day at midnight
garbageCollectionQueue.add("daily-gc", {}, {
    repeat: {
        pattern: "0 0 * * *" // Run at 00:00 every day
    }
});