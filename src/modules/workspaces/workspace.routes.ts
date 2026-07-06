import express from "express"
import { createWorkspace, deleteWorkspace, getWorkspace, sendInviteUser, updateWorkspace } from "./workspace.service"
import { allowedRoles, loadMembership, ownerRole, requiredRole } from "../../api/middlewares/workspaces"

const router = express.Router()

router.post("/create", loadMembership, requiredRole(ownerRole), createWorkspace)
router.patch("/update/:workspaceId", loadMembership, requiredRole(ownerRole), updateWorkspace)
router.delete("/delete/:workspaceId", loadMembership, requiredRole(ownerRole), deleteWorkspace)
router.post("/invite/:workspaceId", loadMembership, requiredRole(ownerRole), sendInviteUser)
router.get("/:workspaceId", loadMembership, requiredRole(allowedRoles), getWorkspace)
export default router