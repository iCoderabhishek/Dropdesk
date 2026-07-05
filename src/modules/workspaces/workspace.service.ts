import type { Request, Response } from "express"
import { prisma } from "../../infrastructure/db"


export const createWorkspace = async (req: Request, res: Response) => {
    try {

        const { workspaceName } = req.body

        const workspace = await prisma.workspaces.create({
            data: {
                workspaceName: workspaceName,
                ownerId: req.user?.userId,
                memberships: {
                    create: {
                        userId: req.user?.userId,
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

export const sendInviteUser = async (req: Request, res: Response) => {
    try {

    } catch (error) {

    }
}

export const sendEmail = async (req: Request, res: Response) => {
    try {

    } catch (error) {

    }
}

export const updateWorkspace = async (req: Request, res: Response) => {
    try {

    } catch (error) {

    }
}

export const deleteWorkspace = async (req: Request, res: Response) => {
    try {

    } catch (error) {

    }
}

export const getWorkspace = async (req: Request, res: Response) => {
    try {

    } catch (error) {

    }
}
