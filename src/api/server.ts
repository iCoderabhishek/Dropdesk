import dotenv from "dotenv"
import express from "express"
import { FRONTEND_BASE_URL, PORT, COOKIE_DOMAIN } from "../config/env"
import oauthRoutes from "../modules/oauth/oauth.routes"
import workspaceRoutes from "../modules/workspaces/workspace.routes"
import cookieSession from "cookie-session"
import filesRoutes from "../modules/media/media.routes"
import foldersRoutes from "../modules/folders/folders.routes"
import "../workers/export.worker"
import "../workers/gc.worker"
import "../workers/thumbnail.worker"
import limiter from "../infrastructure/rate-limiter"
import cors from "cors"
import helmet from "helmet"
import logger from "../infrastructure/logger"
import { setupSwagger } from "./middlewares/swagger"
dotenv.config()


const app = express()
app.set("trust proxy", 1)
app.use(express.json())
app.use(cors({
    origin: FRONTEND_BASE_URL,
    credentials: true
}))
app.use(helmet())

// app middlewares
app.use(cookieSession({
    name: "auth_token",
    keys: ["auth_token"],
    maxAge: 1000 * 60 * 60 * 24 * 7,
    domain: COOKIE_DOMAIN,
    secure: COOKIE_DOMAIN ? true : false,
    sameSite: COOKIE_DOMAIN ? "none" : "lax"
}))
app.use(limiter)
app.use("/api/v1/auth", oauthRoutes)
app.use("/api/v1/workspace", workspaceRoutes)
app.use("/api/v1/files", filesRoutes)
app.use("/api/v1/folders", foldersRoutes)

/**
 * @swagger
 * tags:
 *   name: System
 *   description: System and utility API
 */

/**
 * @swagger
 * /health:
 *   get:
 *     summary: Health check endpoint
 *     tags: [System]
 *     responses:
 *       200:
 *         description: System is healthy
 */
app.get("/health", (req, res) => {
    res.status(200).json({ status: "ok", timestamp: new Date().toISOString() })
})

setupSwagger(app)

app.listen(PORT, () => {
    logger.info(`Server running on port http://localhost:${PORT}`)
})

export default app