import dotenv from "dotenv"
import express from "express"
import { FRONTEND_BASE_URL, PORT } from "../config/env"
import oauthRoutes from "../modules/oauth/oauth.routes"
import workspaceRoutes from "../modules/workspaces/workspace.routes"
import cookieSession from "cookie-session"
import filesRoutes from "../modules/media/media.routes"
import "../workers/export.worker"
import "../workers/gc.worker"
import limiter from "../infrastructure/rate-limiter"
import cors from "cors"
import helmet from "helmet"
import logger from "../infrastructure/logger"
dotenv.config()


const app = express()
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
    maxAge: 1000 * 60 * 60 * 24 * 7
}))
app.use(limiter)
app.use("/api/v1/auth", oauthRoutes)
app.use("/api/v1/workspace", workspaceRoutes)
app.use("/api/v1/files/", filesRoutes)

app.listen(PORT, () => {
    logger.info(`Server running on port http://localhost:${PORT}`)
})

export default app