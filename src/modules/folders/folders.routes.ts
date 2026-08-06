import express from "express";
import { requireAuth } from "../../api/middlewares/auth";
import { allowedRoles, loadMembership, requiredRole, allRoles } from "../../api/middlewares/workspaces";
import { createFolder, deleteFolder, getAllFolders, getFolder, moveFolder, renameFolder, searchFolders } from "./folders.service";

const router = express.Router();

/**
 * @swagger
 * tags:
 *   name: Folders
 *   description: Folder management API
 */

/**
 * @swagger
 * /api/v1/folders/{workspaceId}:
 *   post:
 *     summary: Create a new folder
 *     tags: [Folders]
 *     security:
 *       - cookieAuth: []
 *     parameters:
 *       - in: path
 *         name: workspaceId
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               name:
 *                 type: string
 *               parentId:
 *                 type: string
 *                 nullable: true
 *     responses:
 *       201:
 *         description: Folder created successfully
 *       400:
 *         description: Validation error
 *       401:
 *         description: Unauthorized
 */
router.post("/:workspaceId", requireAuth, loadMembership, requiredRole(allowedRoles), createFolder);

/**
 * @swagger
 * /api/v1/folders/{workspaceId}/search:
 *   get:
 *     summary: Search folders
 *     tags: [Folders]
 *     security:
 *       - cookieAuth: []
 *     parameters:
 *       - in: path
 *         name: workspaceId
 *         required: true
 *         schema:
 *           type: string
 *       - in: query
 *         name: q
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Successfully retrieved folders
 *       401:
 *         description: Unauthorized
 */
router.get("/:workspaceId/search", requireAuth, loadMembership, requiredRole(allRoles), searchFolders);

/**
 * @swagger
 * /api/v1/folders/{workspaceId}:
 *   get:
 *     summary: Get all folders for a workspace
 *     tags: [Folders]
 *     security:
 *       - cookieAuth: []
 *     parameters:
 *       - in: path
 *         name: workspaceId
 *         required: true
 *         schema:
 *           type: string
 *       - in: query
 *         name: parentId
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Successfully retrieved folders
 *       401:
 *         description: Unauthorized
 */
router.get("/:workspaceId", requireAuth, loadMembership, requiredRole(allRoles), getAllFolders);

/**
 * @swagger
 * /api/v1/folders/{workspaceId}/{folderId}:
 *   get:
 *     summary: Get a specific folder
 *     tags: [Folders]
 *     security:
 *       - cookieAuth: []
 *     parameters:
 *       - in: path
 *         name: workspaceId
 *         required: true
 *         schema:
 *           type: string
 *       - in: path
 *         name: folderId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Successfully retrieved folder
 *       401:
 *         description: Unauthorized
 *       404:
 *         description: Folder not found
 */
router.get("/:workspaceId/:folderId", requireAuth, loadMembership, requiredRole(allRoles), getFolder);

/**
 * @swagger
 * /api/v1/folders/{workspaceId}/{folderId}/rename:
 *   patch:
 *     summary: Rename a folder
 *     tags: [Folders]
 *     security:
 *       - cookieAuth: []
 *     parameters:
 *       - in: path
 *         name: workspaceId
 *         required: true
 *         schema:
 *           type: string
 *       - in: path
 *         name: folderId
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               name:
 *                 type: string
 *     responses:
 *       200:
 *         description: Successfully renamed folder
 *       401:
 *         description: Unauthorized
 */
router.patch("/:workspaceId/:folderId/rename", requireAuth, loadMembership, requiredRole(allowedRoles), renameFolder);

/**
 * @swagger
 * /api/v1/folders/{workspaceId}/{folderId}/move:
 *   patch:
 *     summary: Move a folder
 *     tags: [Folders]
 *     security:
 *       - cookieAuth: []
 *     parameters:
 *       - in: path
 *         name: workspaceId
 *         required: true
 *         schema:
 *           type: string
 *       - in: path
 *         name: folderId
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               newParentId:
 *                 type: string
 *                 nullable: true
 *     responses:
 *       200:
 *         description: Successfully moved folder
 *       401:
 *         description: Unauthorized
 */
router.patch("/:workspaceId/:folderId/move", requireAuth, loadMembership, requiredRole(allowedRoles), moveFolder);

/**
 * @swagger
 * /api/v1/folders/{workspaceId}/{folderId}:
 *   delete:
 *     summary: Delete a folder
 *     tags: [Folders]
 *     security:
 *       - cookieAuth: []
 *     parameters:
 *       - in: path
 *         name: workspaceId
 *         required: true
 *         schema:
 *           type: string
 *       - in: path
 *         name: folderId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Successfully deleted folder
 *       401:
 *         description: Unauthorized
 */
router.delete("/:workspaceId/:folderId", requireAuth, loadMembership, requiredRole(allowedRoles), deleteFolder);

export default router;
