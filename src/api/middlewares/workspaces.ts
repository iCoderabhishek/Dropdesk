import type { Request, Response, NextFunction } from "express";
import { prisma } from "../../infrastructure/db";


export const loadMembership = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const workspaceId = req.params.workspaceId as string
        const userId = req.user?.userId
        if (!workspaceId || !userId) {
            return res.status(400).json({ error: "Workspace ID or User ID is required" })
        }
        //searchby member
        const membership = await prisma.memberships.findUnique({
            where: {
                workspaceId_userId: {
                    workspaceId: workspaceId,
                    userId: userId
                }
            }
        })
        if (!membership) {
            return res.status(404).json({ error: "Membership not found" })
        }
        req.membership = membership
        next()
    } catch (error) {
        return res.status(500).json({ error: "Error loading membership" })
    }
}


///a middleware needed to gate by role

export const requiredRole = (roles: string[]) => {
    return (req: Request, res: Response, next: NextFunction) => {
        if (!roles.includes(req.membership?.role)) {
            return res.status(403).json({ error: "Unauthorized" })
        }
        next()
    }
}

// roles to define the access to certain features
export const allowedRoles = ["OWNER", "MEMBER"]
export const viewerRole = ["VIEWER"]
export const ownerRole = ["OWNER"] 
export const allRoles = ["OWNER", "MEMBER", "VIEWER"]