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
} from "./media.service";
import {
  allowedRoles,
  loadMembership,
  requiredRole,
} from "../../api/middlewares/workspaces";
import { requireAuth } from "../../api/middlewares/auth";
import { createExport, getExport } from "./export.service";

const router = express.Router();

router.get("/:workspaceId/all", requireAuth, loadMembership, getAllFiles);
router.post(
  "/:workspaceId/request-upload",
  requireAuth,
  loadMembership,
  requestUpload,
);
router.post(
  "/:workspaceId/confirm-upload/:fileId",
  requireAuth,
  loadMembership,
  confirmUpload,
);
router.get(
  "/:workspaceId/download/:fileId",
  requireAuth,
  loadMembership,
  getDownloadUrl,
);
// for download option pass - ?action=download in query
router.delete(
  "/:workspaceId/delete/:fileId",
  requireAuth,
  loadMembership,
  requiredRole(allowedRoles),
  deleteFile,
);
router.patch(
  "/:workspaceId/public/:fileId",
  requireAuth,
  loadMembership,
  requiredRole(allowedRoles),
  togglePublicStatus,
);
// export jobs
router.post("/:workspaceId/exports", requireAuth, loadMembership, createExport);
router.get(
  "/:workspaceId/exports/:jobId",
  requireAuth,
  loadMembership,
  getExport,
);

// publuc route for streaming
router.get("/public/:fileId/stream", streamPublicProxyHandler);

// trash bin routes
router.get("/:workspaceId/trash", requireAuth, loadMembership, requiredRole(allowedRoles), getTrashbin);
router.patch("/:workspaceId/trash/:fileId/restore", requireAuth, loadMembership, requiredRole(allowedRoles), restoreTrashbin);
router.delete("/:workspaceId/trash/:fileId", requireAuth, loadMembership, requiredRole(allowedRoles), deleteTrashbin);

export default router;