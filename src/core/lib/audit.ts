import { prisma } from "../../infrastructure/db";
import { AuditAction, AuditTargetType } from "@prisma/client";

export async function audit(entry: {
    workspaceId: string; actorId: string; action: AuditAction;
    targetType: AuditTargetType; targetId?: string; metadata?: Record<string, unknown>;
}) {
    await prisma.auditLog.create({
        data: {
            workspaceId: entry.workspaceId,
            actorId: entry.actorId,
            action: entry.action,
            targetType: entry.targetType,
            targetId: entry.targetId,
            metaData: JSON.stringify(entry.metadata ? entry.metadata : undefined),
        }
    });
}
