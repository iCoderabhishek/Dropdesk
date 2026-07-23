import type { Request, Response } from "express";
import { prisma } from "../../infrastructure/db";
import { exportQueue } from "../../infrastructure/queue/export";
import { S3Client, GetObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { S3_REGION, S3_BUCKET } from "../../config/env";
import { audit } from "../../core/lib/audit";

const s3 = new S3Client({
    region: S3_REGION,
    requestChecksumCalculation: "WHEN_REQUIRED",
});

export const createExport = async (req: Request, res: Response) => {
    try {
        const workspaceId = req.params.workspaceId as string
        const userId = req.user?.userId
        if (!userId) return res.status(401).json({ error: "Unauthorized" })

        const { fileIds } = req.body
        if (!fileIds || fileIds.length === 0) return res.status(400).json({ error: "File ids are required" })

        const existingWorkspace = await prisma.workspaces.findFirst({
            where: {
                id: workspaceId,
                memberships: {
                    some: {
                        userId,
                        role: "OWNER"
                    }
                }
            }
        })
        if (!existingWorkspace) return res.status(404).json({ error: "Workspace not found" })

        const existingFiles = await prisma.files.findMany({
            where: {
                id: { in: fileIds },
                workspaceId: workspaceId
            }
        })
        if (existingFiles.length !== fileIds.length) return res.status(404).json({ error: "Some files not found" })

        const job = await prisma.exportJobs.create({
            data: {
                workspaceId: workspaceId,
                fileIds: fileIds,
                status: "PENDING"
            }
        })

        await exportQueue.add("export", { jobId: job.id })

        await audit({
            workspaceId: job.workspaceId, actorId: userId,
            action: "CREATE", targetType: "EXPORT", targetId: job.id,
            metadata: { fileCount: fileIds.length },
        });

        return res.status(201).json({ job: job })
    } catch (error) {
        console.log("createExport error:", error)
        return res.status(500).json({ error: "Error creating export" })
    }
}

export const getExport = async (req: Request, res: Response) => {
    try {
        const userId = req.user?.userId;
        if (!userId) return res.status(401).json({ error: "Unauthorized" });

        const { workspaceId, jobId } = req.params;

        const job = await prisma.exportJobs.findFirst({
            where: {
                id: jobId as string,
                workspaceId: workspaceId as string,
                workspace: {
                    memberships: { some: { userId } }
                }
            }
        });

        if (!job) return res.status(404).json({ error: "Export job not found" });

        if (job.status !== "DONE") {
            return res.status(200).json({ status: job.status });
        }

        if (!job.zipS3Key) {
            return res.status(500).json({ error: "Job is done but missing zip file" });
        }

        const url = await getSignedUrl(
            s3,
            new GetObjectCommand({
                Bucket: S3_BUCKET,
                Key: job.zipS3Key,
                ResponseContentDisposition: `attachment; filename="export-${job.id}.zip"`,
            }),
            { expiresIn: 300 }
        );

        return res.status(200).json({ status: "done", downloadUrl: url });
    } catch (error) {
        console.error("getExport error:", error);
        return res.status(500).json({ error: "Error fetching export status" });
    }
};