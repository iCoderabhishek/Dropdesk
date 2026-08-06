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
  allRoles,
} from "../../api/middlewares/workspaces";
import { requireAuth } from "../../api/middlewares/auth";

const router = express.Router();

/**
 * @swagger
 * tags:
 *   name: Workspaces
 *   description: API for managing workspaces
 */

/**
 * @swagger
 * /api/v1/workspace/create:
 *   post:
 *     summary: Create a new workspace
 *     tags: [Workspaces]
 *     security:
 *       - cookieAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               workspaceName:
 *                 type: string
 *                 example: "My Backend Workspace"
 *     responses:
 *       201:
 *         description: Workspace created successfully
 *       400:
 *         description: Workspace name is required
 *       401:
 *         description: Unauthorized - missing or invalid token
 */
router.post("/create", requireAuth, createWorkspace);

/**
 * @swagger
 * /api/v1/workspace/update/{workspaceId}:
 *   patch:
 *     summary: Update a workspace
 *     tags: [Workspaces]
 *     security:
 *       - cookieAuth: []
 *     parameters:
 *       - in: path
 *         name: workspaceId
 *         required: true
 *         schema:
 *           type: string
 *         description: The workspace ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               workspaceName:
 *                 type: string
 *                 example: "Updated Team Workspace"
 *     responses:
 *       200:
 *         description: Workspace updated successfully
 *       400:
 *         description: Workspace name is required
 *       401:
 *         description: Unauthorized
 *       404:
 *         description: Workspace not found
 */
router.patch(
  "/update/:workspaceId",
  requireAuth,
  loadMembership,
  requiredRole(ownerRole),
  updateWorkspace,
);

/**
 * @swagger
 * /api/v1/workspace/delete/{workspaceId}:
 *   delete:
 *     summary: Delete a workspace
 *     tags: [Workspaces]
 *     security:
 *       - cookieAuth: []
 *     parameters:
 *       - in: path
 *         name: workspaceId
 *         required: true
 *         schema:
 *           type: string
 *         description: The workspace ID
 *     responses:
 *       200:
 *         description: Workspace deleted successfully
 *       400:
 *         description: Workspace ID is required
 *       401:
 *         description: Unauthorized
 *       404:
 *         description: Workspace not found
 */
router.delete(
  "/delete/:workspaceId",
  requireAuth,
  deleteWorkspace,
);

/**
 * @swagger
 * /api/v1/workspace/invite/{workspaceId}:
 *   post:
 *     summary: Send an invite to join a workspace
 *     tags: [Workspaces]
 *     security:
 *       - cookieAuth: []
 *     parameters:
 *       - in: path
 *         name: workspaceId
 *         required: true
 *         schema:
 *           type: string
 *         description: The workspace ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               email:
 *                 type: string
 *                 example: "colleague@example.com"
 *     responses:
 *       200:
 *         description: Invite sent successfully
 *       400:
 *         description: Workspace ID and email are required
 *       401:
 *         description: Unauthorized
 *       404:
 *         description: Workspace not found
 */
router.post(
  "/invite/:workspaceId",
  requireAuth,
  loadMembership,
  requiredRole(ownerRole),
  sendInviteUser,
);

/**
 * @swagger
 * /api/v1/workspace/all:
 *   get:
 *     summary: Get all workspaces for the logged-in user
 *     tags: [Workspaces]
 *     security:
 *       - cookieAuth: []
 *     responses:
 *       200:
 *         description: Successfully retrieved workspaces
 *       401:
 *         description: Unauthorized
 *       404:
 *         description: No workspaces found
 */
router.get("/all", requireAuth, getAllWorkspaces);

/**
 * @swagger
 * /api/v1/workspace/search:
 *   get:
 *     summary: Search for workspaces
 *     tags: [Workspaces]
 *     security:
 *       - cookieAuth: []
 *     parameters:
 *       - in: query
 *         name: q
 *         schema:
 *           type: string
 *         description: Search query for workspace name
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *         description: Page number
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *         description: Number of items per page
 *       - in: query
 *         name: role
 *         schema:
 *           type: string
 *         description: Filter by user role in the workspace
 *     responses:
 *       200:
 *         description: Successfully retrieved workspaces
 *       401:
 *         description: Unauthorized
 */
router.get("/search", requireAuth, searchWorkspaces);

/**
 * @swagger
 * /api/v1/workspace/accept-invite:
 *   post:
 *     summary: Accept a workspace invitation
 *     tags: [Workspaces]
 *     security:
 *       - cookieAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               token:
 *                 type: string
 *                 description: The invite token from the email link
 *     responses:
 *       200:
 *         description: Successfully joined workspace
 *       400:
 *         description: Token is required
 *       401:
 *         description: Invalid or expired token / Unauthorized
 *       403:
 *         description: Invite sent to a different email
 *       404:
 *         description: Workspace or User not found
 */
router.post("/accept-invite", requireAuth, acceptInviteUser);

/**
 * @swagger
 * /api/v1/workspace/{workspaceId}:
 *   get:
 *     summary: Get a specific workspace
 *     tags: [Workspaces]
 *     security:
 *       - cookieAuth: []
 *     parameters:
 *       - in: path
 *         name: workspaceId
 *         required: true
 *         schema:
 *           type: string
 *         description: The workspace ID
 *     responses:
 *       200:
 *         description: Successfully retrieved the workspace
 *       400:
 *         description: Workspace ID is required
 *       401:
 *         description: Unauthorized
 *       404:
 *         description: Workspace not found
 */
router.get(
  "/:workspaceId",
  requireAuth,
  loadMembership,
  requiredRole(allRoles),
  getWorkspace,
);

/**
 * @swagger
 * /api/v1/workspace/{workspaceId}/members/search:
 *   get:
 *     summary: Search members in a workspace
 *     tags: [Workspaces]
 *     security:
 *       - cookieAuth: []
 *     parameters:
 *       - in: path
 *         name: workspaceId
 *         required: true
 *         schema:
 *           type: string
 *         description: The workspace ID
 *       - in: query
 *         name: q
 *         schema:
 *           type: string
 *         description: Search query for member name or email
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *         description: Page number
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *         description: Number of members per page
 *       - in: query
 *         name: role
 *         schema:
 *           type: string
 *         description: Filter by member role
 *     responses:
 *       200:
 *         description: Successfully retrieved members
 *       401:
 *         description: Unauthorized
 */
router.get(
  "/:workspaceId/members/search",
  requireAuth,
  loadMembership,
  requiredRole(allRoles),
  searchMembers,
);

/**
 * @swagger
 * /api/v1/workspace/{workspaceId}/members/all:
 *   get:
 *     summary: Get all members in a workspace
 *     tags: [Workspaces]
 *     security:
 *       - cookieAuth: []
 *     parameters:
 *       - in: path
 *         name: workspaceId
 *         required: true
 *         schema:
 *           type: string
 *         description: The workspace ID
 *       - in: query
 *         name: role
 *         schema:
 *           type: string
 *         description: Filter by member role (e.g. OWNER, MEMBER, VIEWER, PENDING)
 *     responses:
 *       200:
 *         description: Successfully retrieved all members
 *       400:
 *         description: Invalid role specified
 *       401:
 *         description: Unauthorized
 *       404:
 *         description: No members found
 */
router.get("/:workspaceId/members/all", requireAuth, loadMembership, requiredRole(allRoles), getALlMembers)

export default router;
