import type { Request, Response } from "express"
import { prisma } from "../../infrastructure/db"
import { sendInviteEmail } from "../../infrastructure/email/sendEmail"
import jwt from "jsonwebtoken"
import { JWT_PRIVATE_KEY } from "../../config/env"
import { redis } from "../../config/redis"


export const createWorkspace = async (req: Request, res: Response) => {
    try {

        const { workspaceName } = req.body
        const userId = req.user?.userId
        if (!userId) return res.status(401).json({ error: "Unauthorized" });

        if (!workspaceName) return res.status(400).json({ error: "Workspace name is required" })
        const workspace = await prisma.workspaces.create({
            data: {
                workspaceName: workspaceName,
                ownerId: userId,
                memberships: {
                    create: {
                        userId: userId,
                        role: 'OWNER'
                    }
                }
            }
        })

        return res.status(201).json({ workspace: workspace })


    } catch (error) {
        return res.status(500).json({ error: "Error creating workspace" })
    }
}


export const getWorkspace = async (req: Request, res: Response) => {
    try {
        const workspaceId = req.params.workspaceId as string
        const userId = req.user?.userId
        if (!req.user?.userId) return res.status(401).json({ error: "Unauthorized" });


        if (!workspaceId) {
            return res.status(400).json({ error: "Workspace ID is required" })
        }

        const workspace = await prisma.workspaces.findFirst({
            where: {
                id: workspaceId,
                memberships: {
                    some: {
                        userId,
                        role: "OWNER"
                    }
                }
            },
        })


        if (!workspace) {
            return res.status(404).json({ error: "Workspace not found" })
        }

        return res.status(200).json({ workspace: workspace })

    } catch (error) {
        console.log("getWorkspace error:", error);
        return res.status(500).json({ error: "Error getting workspace" })
    }
}


export const getAllWorkspaces = async (req: Request, res: Response) => {
    try {
        const userId = req.user?.userId
        if (!req.user?.userId) return res.status(401).json({ error: "Unauthorized" });

        const cachedKey = `ws:${userId}`
        const cachedData = await redis.get(cachedKey);
        if (cachedData) {
            return res.status(200).json({ workspaces: JSON.parse(cachedData) })
        }
        const workspaces = await prisma.workspaces.findMany({
            where: {
                memberships: {
                    some: {
                        userId,
                        role: {
                            in: ["OWNER", "MEMBER"]
                        }
                    }
                }
            },
        })

        if (!workspaces) {
            return res.status(404).json({ error: "No workspaces found" })
        }
        redis.set(cachedKey, JSON.stringify(workspaces), "EX", 60 * 15) // mins: 15
        return res.status(200).json({ workspaces: workspaces })
    } catch (error) {
        console.log("getAllWorkspaces error:", error);
        return res.status(500).json({ error: "Error getting all workspaces" })
    }
}



export const updateWorkspace = async (req: Request, res: Response) => {
    try {

        const { workspaceName } = req.body
        const workspaceId = req.params.workspaceId as string
        const userId = req.user?.userId
        if (!userId) return res.status(401).json({ error: "Unauthorized" });

        if (!workspaceName) return res.status(400).json({ error: "Workspace name is required" })

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

        const workspace = await prisma.workspaces.update({
            where: {
                id: workspaceId,
            },
            data: {
                workspaceName: workspaceName,
            }
        })

        return res.status(200).json({ workspace: workspace })


    } catch (error) {
        console.log("updateWorkspace error:", error);

        return res.status(500).json({ error: "Error updating workspace" })
    }
}

export const deleteWorkspace = async (req: Request, res: Response) => {
    try {

        const workspaceId = req.params.workspaceId as string
        const userId = req.user?.userId
        if (!userId) return res.status(401).json({ error: "Unauthorized" });

        if (!workspaceId) {
            return res.status(400).json({ error: "Workspace ID is required" })
        }

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

        const workspace = await prisma.workspaces.delete({
            where: {
                id: workspaceId
            }
        })

        return res.status(200).json({ deleted: true })
    } catch (error) {
        return res.status(500).json({ error: "Error deleting workspace" })
    }
}



export const sendInviteUser = async (req: Request, res: Response) => {
    try {

        const workspaceId = req.params.workspaceId as string
        const email = req.body.email as string


        const userId = req.user?.userId
        if (!userId) return res.status(401).json({ error: "Unauthorized" });

        if (!workspaceId || !email) return res.status(400).json({ error: "Workspace ID and email are required" })

        const workspace = await prisma.workspaces.findFirst({
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
        if (!workspace) return res.status(404).json({ error: "Workspace not found" })

        const payload = {
            email: email,
            workspaceId: workspaceId
        }
        const workspaceName = workspace.workspaceName

        // generate invite link with expiry date and sign it with jwt (not saving the url to db tho)

        const token = jwt.sign(payload, JWT_PRIVATE_KEY, { expiresIn: "7d" })
        const inviteLink = `${process.env.FRONTEND_BASE_URL}/invite/workspace?token=${token}`

        await sendInviteEmail(email, workspaceName, inviteLink)
        return res.status(200).json({ message: "Invite sent successfully" })
    } catch (error) {
        return res.status(500).json({ error: "Error sending invite" })
    }
}


export const acceptInviteUser = async (req: Request, res: Response) => {
    try {
        const token = req.body.token as string
        if (!token) return res.status(400).json({ error: "Token is required" })

        let decoded: { email: string; workspaceId: string }
        try {
            decoded = jwt.verify(token, JWT_PRIVATE_KEY) as { email: string; workspaceId: string }
        } catch {
            return res.status(401).json({ error: "Invalid or expired token" })
        }

        // look up the logged-in user &   get their email
        const userId = req.user?.userId
        if (!userId) return res.status(401).json({ error: "Unauthorized" })

        const user = await prisma.users.findUnique({ where: { id: userId } })
        if (!user) return res.status(404).json({ error: "User not found" })


        // making js happy
        if (user.email.toLowerCase() !== decoded.email.toLowerCase()) {
            return res.status(403).json({ error: "This invite was sent to a different email" })
        }
        const workspace = await prisma.workspaces.findUnique({ where: { id: decoded.workspaceId } })
        if (!workspace) return res.status(404).json({ error: "Workspace not found" })


        await prisma.memberships.upsert({
            where: { workspaceId_userId: { workspaceId: workspace.id, userId } },
            update: {},
            create: { userId, workspaceId: workspace.id, role: "MEMBER" },
        })

        // done

        return res.status(200).json({ joined: true, workspaceId: workspace.id })
    } catch (error) {
        console.log("acceptInviteUser error:", error)
        return res.status(500).json({ error: "Error accepting invite" })
    }
}