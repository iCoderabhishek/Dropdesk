import express from "express";
import { confirmUpload, deleteFile, getAllFiles, getDownloadUrl, requestUpload, streamPublicProxyHandler, togglePublicStatus } from "./media.service";
import { allowedRoles, loadMembership, requiredRole } from "../../api/middlewares/workspaces";
import { requireAuth } from "../../api/middlewares/auth";
import { createExport, getExport } from "./export.service";


const router = express.Router()


router.get("/:workspaceId/all", requireAuth, loadMembership, getAllFiles)
router.post("/:workspaceId/request-upload", requireAuth, loadMembership, requestUpload)
router.post("/:workspaceId/confirm-upload/:fileId", requireAuth, loadMembership, confirmUpload)
router.get("/:workspaceId/download/:fileId", requireAuth, loadMembership, getDownloadUrl)
// for download option pass - ?action=download in query
router.delete("/:workspaceId/delete/:fileId", requireAuth, loadMembership, requiredRole(allowedRoles), deleteFile)
router.patch("/:workspaceId/public/:fileId", requireAuth, loadMembership, togglePublicStatus)
export default router

// export jobs
router.post("/:workspaceId/exports", requireAuth, loadMembership, createExport)
router.get("/:workspaceId/exports/:jobId", requireAuth, loadMembership, getExport)

// publuc route for streaming
router.get("/public/:fileId/stream", streamPublicProxyHandler)
