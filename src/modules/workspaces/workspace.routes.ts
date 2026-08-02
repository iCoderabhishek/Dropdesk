import express from "express";
import {
  acceptInviteUser,
  createWorkspace,
  deleteWorkspace,
  getAllWorkspaces,
  getWorkspace,
  sendInviteUser,
  updateWorkspace,
  searchWorkspaces,
  searchMembers,
  getALlMembers,
} from "./workspace.service";
import {
  allowedRoles,
  loadMembership,
  ownerRole,
  requiredRole,
} from "../../api/middlewares/workspaces";
import { requireAuth } from "../../api/middlewares/auth";

const router = express.Router();

router.post("/create", requireAuth, createWorkspace);
router.patch(
  "/update/:workspaceId",
  requireAuth,
  loadMembership,
  requiredRole(ownerRole),
  updateWorkspace,
);
router.delete(
  "/delete/:workspaceId",
  requireAuth,
  loadMembership,
  requiredRole(ownerRole),
  deleteWorkspace,
);
router.post(
  "/invite/:workspaceId",
  requireAuth,
  loadMembership,
  requiredRole(ownerRole),
  sendInviteUser,
);
router.get("/all", requireAuth, getAllWorkspaces);
router.get("/search", requireAuth, searchWorkspaces);
router.post("/accept-invite", requireAuth, acceptInviteUser);
router.get(
  "/:workspaceId",
  requireAuth,
  loadMembership,
  requiredRole(allowedRoles),
  getWorkspace,
);
router.get(
  "/:workspaceId/members/search",
  requireAuth,
  loadMembership,
  requiredRole(allowedRoles),
  searchMembers,
);


router.get("/:workspaceId/members/all", requireAuth, loadMembership, requiredRole(allowedRoles), getALlMembers)
export default router;
