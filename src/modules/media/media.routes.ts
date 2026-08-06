import express from "express";
import {
  confirmUpload,
  deleteFile,
  deleteTrashbin,
  getAllFiles,
  getDownloadUrl,
  getTrashbin,
  requestUpload,
  restoreTrashbin,
  streamPublicProxyHandler,
  togglePublicStatus,
  searchFiles,
  moveFile,
  getStorageQuota,
} from "./media.service";
import {
  allowedRoles,
  loadMembership,
  requiredRole,
  allRoles,
} from "../../api/middlewares/workspaces";
import { requireAuth } from "../../api/middlewares/auth";
import { createExport, getExport, getAllExports, cancelExport, retryExport } from "./export.service";

const router = express.Router();

/**
 * @swagger
 * tags:
 *   name: Media
 *   description: Media and file management API
 */

/**
 * @swagger
 * /api/v1/files/{workspaceId}/all:
 *   get:
 *     summary: Get all files for a workspace
 *     tags: [Media]
 *     security:
 *       - cookieAuth: []
 *     parameters:
 *       - in: path
 *         name: workspaceId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Successfully retrieved files
 *       401:
 *         description: Unauthorized
 */
router.get("/:workspaceId/all", requireAuth, loadMembership, requiredRole(allRoles), getAllFiles);

/**
 * @swagger
 * /api/v1/files/{workspaceId}/search:
 *   get:
 *     summary: Search for files
 *     tags: [Media]
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
 *         description: Successfully retrieved files
 *       401:
 *         description: Unauthorized
 */
router.get("/:workspaceId/search", requireAuth, loadMembership, requiredRole(allRoles), searchFiles);

/**
 * @swagger
 * /api/v1/files/{workspaceId}/quota:
 *   get:
 *     summary: Get storage quota for a workspace
 *     tags: [Media]
 *     security:
 *       - cookieAuth: []
 *     parameters:
 *       - in: path
 *         name: workspaceId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Successfully retrieved quota
 *       401:
 *         description: Unauthorized
 */
router.get("/:workspaceId/quota", requireAuth, loadMembership, requiredRole(allowedRoles), getStorageQuota);

/**
 * @swagger
 * /api/v1/files/{workspaceId}/request-upload:
 *   post:
 *     summary: Request a presigned URL for file upload
 *     tags: [Media]
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
 *               fileName:
 *                 type: string
 *               fileType:
 *                 type: string
 *               fileSize:
 *                 type: integer
 *               folderId:
 *                 type: string
 *     responses:
 *       200:
 *         description: Presigned URL generated successfully
 *       401:
 *         description: Unauthorized
 */
router.post(
  "/:workspaceId/request-upload",
  requireAuth,
  loadMembership,
  requiredRole(allowedRoles),
  requestUpload,
);

/**
 * @swagger
 * /api/v1/files/{workspaceId}/confirm-upload/{fileId}:
 *   post:
 *     summary: Confirm file upload completion
 *     tags: [Media]
 *     security:
 *       - cookieAuth: []
 *     parameters:
 *       - in: path
 *         name: workspaceId
 *         required: true
 *         schema:
 *           type: string
 *       - in: path
 *         name: fileId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: File upload confirmed
 *       401:
 *         description: Unauthorized
 */
router.post(
  "/:workspaceId/confirm-upload/:fileId",
  requireAuth,
  loadMembership,
  requiredRole(allowedRoles),
  confirmUpload,
);

/**
 * @swagger
 * /api/v1/files/{workspaceId}/download/{fileId}:
 *   get:
 *     summary: Get a download URL for a file
 *     tags: [Media]
 *     security:
 *       - cookieAuth: []
 *     parameters:
 *       - in: path
 *         name: workspaceId
 *         required: true
 *         schema:
 *           type: string
 *       - in: path
 *         name: fileId
 *         required: true
 *         schema:
 *           type: string
 *       - in: query
 *         name: action
 *         schema:
 *           type: string
 *           description: Pass "download" to force download
 *     responses:
 *       200:
 *         description: Download URL generated
 *       401:
 *         description: Unauthorized
 */
router.get(
  "/:workspaceId/download/:fileId",
  requireAuth,
  loadMembership,
  requiredRole(allRoles),
  getDownloadUrl,
);

/**
 * @swagger
 * /api/v1/files/{workspaceId}/delete/{fileId}:
 *   delete:
 *     summary: Move a file to the trash bin
 *     tags: [Media]
 *     security:
 *       - cookieAuth: []
 *     parameters:
 *       - in: path
 *         name: workspaceId
 *         required: true
 *         schema:
 *           type: string
 *       - in: path
 *         name: fileId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: File moved to trash
 *       401:
 *         description: Unauthorized
 */
router.delete(
  "/:workspaceId/delete/:fileId",
  requireAuth,
  loadMembership,
  requiredRole(allowedRoles),
  deleteFile,
);

/**
 * @swagger
 * /api/v1/files/{workspaceId}/public/{fileId}:
 *   patch:
 *     summary: Toggle public sharing status of a file
 *     tags: [Media]
 *     security:
 *       - cookieAuth: []
 *     parameters:
 *       - in: path
 *         name: workspaceId
 *         required: true
 *         schema:
 *           type: string
 *       - in: path
 *         name: fileId
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
 *               isPublic:
 *                 type: boolean
 *     responses:
 *       200:
 *         description: Public status toggled
 *       401:
 *         description: Unauthorized
 */
router.patch(
  "/:workspaceId/public/:fileId",
  requireAuth,
  loadMembership,
  requiredRole(allowedRoles),
  togglePublicStatus,
);

/**
 * @swagger
 * /api/v1/files/{workspaceId}/move/{fileId}:
 *   patch:
 *     summary: Move a file to a new folder
 *     tags: [Media]
 *     security:
 *       - cookieAuth: []
 *     parameters:
 *       - in: path
 *         name: workspaceId
 *         required: true
 *         schema:
 *           type: string
 *       - in: path
 *         name: fileId
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
 *               folderId:
 *                 type: string
 *     responses:
 *       200:
 *         description: File moved successfully
 *       401:
 *         description: Unauthorized
 */
router.patch(
  "/:workspaceId/move/:fileId",
  requireAuth,
  loadMembership,
  requiredRole(allowedRoles),
  moveFile
);

/**
 * @swagger
 * /api/v1/files/{workspaceId}/exports:
 *   post:
 *     summary: Create an export job for the workspace
 *     tags: [Media]
 *     security:
 *       - cookieAuth: []
 *     parameters:
 *       - in: path
 *         name: workspaceId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       201:
 *         description: Export job created
 *       401:
 *         description: Unauthorized
 */
router.post("/:workspaceId/exports", requireAuth, loadMembership, requiredRole(allRoles), createExport);

/**
 * @swagger
 * /api/v1/files/{workspaceId}/exports/all:
 *   get:
 *     summary: Get all export jobs
 *     tags: [Media]
 *     security:
 *       - cookieAuth: []
 *     parameters:
 *       - in: path
 *         name: workspaceId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Successfully retrieved export jobs
 *       401:
 *         description: Unauthorized
 */
router.get("/:workspaceId/exports/all", requireAuth, loadMembership, requiredRole(allRoles), getAllExports);

/**
 * @swagger
 * /api/v1/files/{workspaceId}/exports/{jobId}:
 *   get:
 *     summary: Get status of a specific export job
 *     tags: [Media]
 *     security:
 *       - cookieAuth: []
 *     parameters:
 *       - in: path
 *         name: workspaceId
 *         required: true
 *         schema:
 *           type: string
 *       - in: path
 *         name: jobId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Successfully retrieved export job status
 *       401:
 *         description: Unauthorized
 */
router.get(
  "/:workspaceId/exports/:jobId",
  requireAuth,
  loadMembership,
  requiredRole(allRoles),
  getExport,
);

/**
 * @swagger
 * /api/v1/files/{workspaceId}/exports/{jobId}/retry:
 *   post:
 *     summary: Retry a failed export job
 *     tags: [Media]
 *     security:
 *       - cookieAuth: []
 *     parameters:
 *       - in: path
 *         name: workspaceId
 *         required: true
 *         schema:
 *           type: string
 *       - in: path
 *         name: jobId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Export job retried
 *       401:
 *         description: Unauthorized
 */
router.post("/:workspaceId/exports/:jobId/retry", requireAuth, loadMembership, requiredRole(allRoles), retryExport);

/**
 * @swagger
 * /api/v1/files/{workspaceId}/exports/{jobId}:
 *   delete:
 *     summary: Cancel or delete an export job
 *     tags: [Media]
 *     security:
 *       - cookieAuth: []
 *     parameters:
 *       - in: path
 *         name: workspaceId
 *         required: true
 *         schema:
 *           type: string
 *       - in: path
 *         name: jobId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Export job cancelled/deleted
 *       401:
 *         description: Unauthorized
 */
router.delete("/:workspaceId/exports/:jobId", requireAuth, loadMembership, requiredRole(allRoles), cancelExport);

/**
 * @swagger
 * /api/v1/files/public/{fileId}/stream:
 *   get:
 *     summary: Stream a public file
 *     tags: [Media]
 *     parameters:
 *       - in: path
 *         name: fileId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: File stream
 *       404:
 *         description: File not found or not public
 */
router.get("/public/:fileId/stream", streamPublicProxyHandler);

/**
 * @swagger
 * /api/v1/files/{workspaceId}/trash:
 *   get:
 *     summary: Get all items in the trash bin
 *     tags: [Media]
 *     security:
 *       - cookieAuth: []
 *     parameters:
 *       - in: path
 *         name: workspaceId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Successfully retrieved trash bin
 *       401:
 *         description: Unauthorized
 */
router.get("/:workspaceId/trash", requireAuth, loadMembership, requiredRole(allowedRoles), getTrashbin);

/**
 * @swagger
 * /api/v1/files/{workspaceId}/trash/{fileId}/restore:
 *   patch:
 *     summary: Restore a file from the trash bin
 *     tags: [Media]
 *     security:
 *       - cookieAuth: []
 *     parameters:
 *       - in: path
 *         name: workspaceId
 *         required: true
 *         schema:
 *           type: string
 *       - in: path
 *         name: fileId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: File restored
 *       401:
 *         description: Unauthorized
 */
router.patch("/:workspaceId/trash/:fileId/restore", requireAuth, loadMembership, requiredRole(allowedRoles), restoreTrashbin);

/**
 * @swagger
 * /api/v1/files/{workspaceId}/trash/{fileId}:
 *   delete:
 *     summary: Permanently delete a file from the trash bin
 *     tags: [Media]
 *     security:
 *       - cookieAuth: []
 *     parameters:
 *       - in: path
 *         name: workspaceId
 *         required: true
 *         schema:
 *           type: string
 *       - in: path
 *         name: fileId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: File permanently deleted
 *       401:
 *         description: Unauthorized
 */
router.delete("/:workspaceId/trash/:fileId", requireAuth, loadMembership, requiredRole(allowedRoles), deleteTrashbin);

export default router;