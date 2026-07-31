import express from "express";
import { requireAuth } from "../../api/middlewares/auth";
import { allowedRoles, loadMembership, requiredRole } from "../../api/middlewares/workspaces";
import { createFolder, deleteFolder, getAllFolders, getFolder, moveFolder, renameFolder, searchFolders } from "./folders.service";

const router = express.Router();

router.post("/:workspaceId", requireAuth, loadMembership, requiredRole(allowedRoles), createFolder);
router.get("/:workspaceId/search", requireAuth, loadMembership, searchFolders);
router.get("/:workspaceId", requireAuth, loadMembership, getAllFolders);
router.get("/:workspaceId/:folderId", requireAuth, loadMembership, getFolder);
router.patch("/:workspaceId/:folderId/rename", requireAuth, loadMembership, requiredRole(allowedRoles), renameFolder);
router.patch("/:workspaceId/:folderId/move", requireAuth, loadMembership, requiredRole(allowedRoles), moveFolder);
router.delete("/:workspaceId/:folderId", requireAuth, loadMembership, requiredRole(allowedRoles), deleteFolder);

export default router;
