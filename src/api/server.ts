import dotenv from "dotenv"
import express from "express"
import { PORT } from "../config/env"
import oauthRoutes from "../modules/oauth/oauth.routes"
import workspaceRoutes from "../modules/workspaces/workspace.routes"
import cookieSession from "cookie-session"
import filesRoutes from "../modules/media/media.routes"
import "../workers/export.worker"
import limiter from "../infrastructure/rate-limiter"
dotenv.config()


const app = express()
app.use(express.json())

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
    console.log(`Server running on port http://localhost:${PORT}`)
})

export default app