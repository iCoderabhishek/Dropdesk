import dotenv from "dotenv"
import express from "express"
import { PORT } from "../config/env"
import oauthRoutes from "../modules/oauth/oauth.routes"
import cookieSession from "cookie-session"
dotenv.config()


const app = express()
app.use(express.json())

// app middlewares
app.use(cookieSession({
    name: "auth_token",
    keys: ["auth_token"],
    maxAge: 1000 * 60 * 60 * 24 * 7
}))

app.use("/auth", oauthRoutes)

app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`)
})

export default app