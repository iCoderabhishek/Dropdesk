import express from "express";
import { confirmUpload, getDownloadUrl, requestUpload } from "./media.service";
import { loadMembership } from "../../api/middlewares/workspaces";
import { requireAuth } from "../../api/middlewares/auth";


const router = express.Router()

router.post("/:workspaceId/request-upload", requireAuth, loadMembership, requestUpload)
router.post("/:workspaceId/confirm-upload/:fileId", requireAuth, loadMembership, confirmUpload)
router.get("/:workspaceId/download/:fileId", requireAuth, loadMembership, getDownloadUrl)

export default router