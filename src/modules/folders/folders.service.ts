import type { Request, Response } from "express";
import { prisma } from "../../infrastructure/db";
import { CacheService, CacheKeys } from "../../infrastructure/redis/cache.service";
import { audit } from "../../core/lib/audit";
import logger from "../../infrastructure/logger";

export const createFolder = async (req: Request, res: Response) => {
    try {
        const { name, parentId } = req.body;
        const workspaceId = req.params.workspaceId as string;
        const userId = req.user?.userId;

        if (!userId) return res.status(401).json({ error: "Unauthorized" });
        if (!name) return res.status(400).json({ error: "Folder name is required" });

        const folder = await prisma.folders.create({
            data: {
                name,
                workspaceId,
                parentId: parentId || null,
            },
        });

        await CacheService.clearWorkspaceFolders(workspaceId);

        await audit({
            workspaceId,
            actorId: userId,
            action: "CREATE",
            targetType: "FOLDER",
            targetId: folder.id,
            metadata: { folderName: name, parentId },
        });

        return res.status(201).json({ folder });
    } catch (error) {
        logger.error("Error creating folder:", error);
        return res.status(500).json({ error: "Error creating folder" });
    }
};

export const getAllFolders = async (req: Request, res: Response) => {
    try {
        const workspaceId = req.params.workspaceId as string;
        const parentId = req.query.parentId as string | undefined;

        const cachedKey = CacheKeys.workspaceFolders(workspaceId, parentId);
        const cachedData = await CacheService.get<any>(cachedKey);
        
        if (cachedData) {
            return res.status(200).json({ folders: cachedData });
        }

        const whereClause: any = {
            workspaceId,
            deletedAt: null,
        };

        if (parentId !== undefined) {
            whereClause.parentId = parentId === "null" ? null : parentId;
        }

        const folders = await prisma.folders.findMany({
            where: whereClause,
            orderBy: { name: 'asc' }
        });

        await CacheService.set(cachedKey, folders, 60);

        return res.status(200).json({ folders });
    } catch (error) {
        logger.error("Error fetching folders:", error);
        return res.status(500).json({ error: "Error fetching folders" });
    }
};

export const renameFolder = async (req: Request, res: Response) => {
    try {
        const { name } = req.body;
        const workspaceId = req.params.workspaceId as string;
        const folderId = req.params.folderId as string;
        const userId = req.user?.userId;

        if (!userId) return res.status(401).json({ error: "Unauthorized" });
        if (!name) return res.status(400).json({ error: "New name is required" });

        const folder = await prisma.folders.update({
            where: { id: folderId, workspaceId },
            data: { name },
        });

        await CacheService.clearWorkspaceFolders(workspaceId);

        await audit({
            workspaceId,
            actorId: userId,
            action: "UPDATE",
            targetType: "FOLDER",
            targetId: folder.id,
            metadata: { newName: name, operation: "rename" },
        });

        return res.status(200).json({ folder });
    } catch (error) {
        logger.error("Error renaming folder:", error);
        return res.status(500).json({ error: "Error renaming folder" });
    }
};

export const moveFolder = async (req: Request, res: Response) => {
    try {
        const { parentId } = req.body;
        const workspaceId = req.params.workspaceId as string;
        const folderId = req.params.folderId as string;
        const userId = req.user?.userId;

        if (!userId) return res.status(401).json({ error: "Unauthorized" });

        if (folderId === parentId) {
            return res.status(400).json({ error: "Cannot move a folder into itself" });
        }

        const folder = await prisma.folders.update({
            where: { id: folderId, workspaceId },
            data: { parentId: parentId || null },
        });

        await CacheService.clearWorkspaceFolders(workspaceId);

        await audit({
            workspaceId,
            actorId: userId,
            action: "MOVE",
            targetType: "FOLDER",
            targetId: folder.id,
            metadata: { newParentId: parentId },
        });

        return res.status(200).json({ folder });
    } catch (error) {
        logger.error("Error moving folder:", error);
        return res.status(500).json({ error: "Error moving folder" });
    }
};

export const deleteFolder = async (req: Request, res: Response) => {
    try {
        const workspaceId = req.params.workspaceId as string;
        const folderId = req.params.folderId as string;
        const userId = req.user?.userId;

        if (!userId) return res.status(401).json({ error: "Unauthorized" });

        const folder = await prisma.folders.update({
            where: { id: folderId, workspaceId },
            data: { deletedAt: new Date() },
        });

        await CacheService.clearWorkspaceFolders(workspaceId);

        await audit({
            workspaceId,
            actorId: userId,
            action: "DELETE",
            targetType: "FOLDER",
            targetId: folder.id,
            metadata: { parentId: folder.parentId, folderName: folder.name },
        });

        return res.status(200).json({ success: true, folder });
    } catch (error) {
        logger.error("Error deleting folder:", error);
        return res.status(500).json({ error: "Error deleting folder" });
    }
};



export const getFolder = async (req: Request, res: Response) => {
    try {
        const workspaceId = req.params.workspaceId as string;
        const folderId = req.params.folderId as string;
        const folder = await prisma.folders.findFirst({
            where: { id: folderId, workspaceId, deletedAt: null },
            include: { 
                subFolders: { where: { deletedAt: null }, orderBy: { name: 'asc' } }, 
                files: { where: { deletedAt: null }, orderBy: { createdAt: 'desc' } } 
            }
        });
        if (!folder) return res.status(404).json({ error: "Folder not found" });
        
        const safeFiles = folder.files.map((file) => ({
            ...file,
            size: file.size?.toString(),
        }));

        return res.status(200).json({ 
            folder: {
                ...folder,
                files: safeFiles
            } 
        });
    } catch (error) {
        logger.error("Error fetching folder:", error);
        return res.status(500).json({ error: "Error fetching folder" });
    }
};

export const searchFolders = async (req: Request, res: Response) => {
    try {
        const workspaceId = req.params.workspaceId as string;
        const query = req.query.q as string;
        if (!query) return res.status(400).json({ error: "Query parameter 'q' is required" });

        const folders = await prisma.folders.findMany({
            where: {
                workspaceId,
                deletedAt: null,
                name: { contains: query, mode: "insensitive" }
            }
        });
        return res.status(200).json({ folders });
    } catch (error) {
        logger.error("Error searching folders:", error);
        return res.status(500).json({ error: "Error searching folders" });
    }
};
