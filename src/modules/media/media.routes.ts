import express from "express";
import { confirmUpload, getDownloadUrl, requestUpload } from "./media.service";


const router = express.Router()

router.post("/:workspaceId/request-upload", requestUpload)
router.post("/:workspaceId/confirm-upload/:fileId", confirmUpload)
router.get("/:workspaceId/download/:fileId", getDownloadUrl)

export default router