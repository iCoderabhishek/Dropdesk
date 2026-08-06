import express from "express"
import { getGoogleCallback, getGoogleOAuthUrl, getUser, logout } from "./oauth.service"
import { requireAuth } from "../../api/middlewares/auth"
import { authLimiter } from "../../infrastructure/rate-limiter"

const router = express.Router()

/**
 * @swagger
 * tags:
 *   name: Auth
 *   description: Authentication API
 */

/**
 * @swagger
 * /api/v1/auth/google:
 *   get:
 *     summary: Initiate Google OAuth login
 *     tags: [Auth]
 *     responses:
 *       302:
 *         description: Redirects to Google OAuth consent screen
 */
router.get("/google", authLimiter, getGoogleOAuthUrl)

/**
 * @swagger
 * /api/v1/auth/callback:
 *   get:
 *     summary: Google OAuth callback (internal use)
 *     tags: [Auth]
 *     parameters:
 *       - in: query
 *         name: code
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       302:
 *         description: Redirects to frontend with cookie set
 *       400:
 *         description: Code is required
 *       500:
 *         description: Google auth failed
 */
router.get("/callback", getGoogleCallback)

/**
 * @swagger
 * /api/v1/auth/me:
 *   get:
 *     summary: Get currently authenticated user
 *     tags: [Auth]
 *     security:
 *       - cookieAuth: []
 *     responses:
 *       200:
 *         description: Successfully retrieved user
 *       401:
 *         description: Unauthorized
 */
router.get("/me", requireAuth, getUser)

/**
 * @swagger
 * /api/v1/auth/logout:
 *   post:
 *     summary: Log out user and clear session
 *     tags: [Auth]
 *     responses:
 *       200:
 *         description: Logged out successfully
 *       500:
 *         description: Error logging out
 */
router.post("/logout", logout)

export default router