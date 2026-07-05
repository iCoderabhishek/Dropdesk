import express from "express"
import { createWorkspace } from "./workspace.service"
import { loadMembership, ownerRole, requiredRole } from "../../api/middlewares/workspaces"

const router = express.Router()

router.post("/create", loadMembership, requiredRole(ownerRole), createWorkspace)