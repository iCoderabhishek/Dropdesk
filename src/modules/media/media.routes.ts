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

router.get("/:workspaceId/all", requireAuth, loadMembership, requiredRole(allRoles), getAllFiles);
router.get("/:workspaceId/search", requireAuth, loadMembership, requiredRole(allRoles), searchFiles);
router.get("/:workspaceId/quota", requireAuth, loadMembership, requiredRole(allowedRoles), getStorageQuota);
router.post(
  "/:workspaceId/request-upload",
  requireAuth,
  loadMembership,
  requiredRole(allowedRoles),
  requestUpload,
);
router.post(
  "/:workspaceId/confirm-upload/:fileId",
  requireAuth,
  loadMembership,
  requiredRole(allowedRoles),
  confirmUpload,
);
router.get(
  "/:workspaceId/download/:fileId",
  requireAuth,
  loadMembership,
  requiredRole(allRoles),
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
router.patch(
  "/:workspaceId/move/:fileId",
  requireAuth,
  loadMembership,
  requiredRole(allowedRoles),
  moveFile
);
// export jobs
router.post("/:workspaceId/exports", requireAuth, loadMembership, requiredRole(allRoles), createExport);
router.get("/:workspaceId/exports/all", requireAuth, loadMembership, requiredRole(allRoles), getAllExports);
router.get(
  "/:workspaceId/exports/:jobId",
  requireAuth,
  loadMembership,
  requiredRole(allRoles),
  getExport,
);
router.post("/:workspaceId/exports/:jobId/retry", requireAuth, loadMembership, requiredRole(allRoles), retryExport);
router.delete("/:workspaceId/exports/:jobId", requireAuth, loadMembership, requiredRole(allRoles), cancelExport);

// publuc route for streaming
router.get("/public/:fileId/stream", streamPublicProxyHandler);

// trash bin routes
router.get("/:workspaceId/trash", requireAuth, loadMembership, requiredRole(allowedRoles), getTrashbin);
router.patch("/:workspaceId/trash/:fileId/restore", requireAuth, loadMembership, requiredRole(allowedRoles), restoreTrashbin);
router.delete("/:workspaceId/trash/:fileId", requireAuth, loadMembership, requiredRole(allowedRoles), deleteTrashbin);

export default router;