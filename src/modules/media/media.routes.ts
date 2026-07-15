import express from "express";
import { confirmUpload, deleteFile, getAllFiles, getDownloadUrl, requestUpload } from "./media.service";
import { allowedRoles, loadMembership, requiredRole } from "../../api/middlewares/workspaces";
import { requireAuth } from "../../api/middlewares/auth";


const router = express.Router()


router.get("/:workspaceId/all", requireAuth, loadMembership, getAllFiles)
router.post("/:workspaceId/request-upload", requireAuth, loadMembership, requestUpload)
router.post("/:workspaceId/confirm-upload/:fileId", requireAuth, loadMembership, confirmUpload)
router.get("/:workspaceId/download/:fileId", requireAuth, loadMembership, getDownloadUrl)
// for download option pass - ?action=download in query
router.delete("/:workspaceId/delete/:fileId", requireAuth, loadMembership, requiredRole(allowedRoles), deleteFile)
export default router