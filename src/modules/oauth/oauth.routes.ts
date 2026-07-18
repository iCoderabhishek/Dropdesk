import express from "express"
import { getGoogleCallback, getGoogleOAuthUrl, getUser } from "./oauth.service"
import { requireAuth } from "../../api/middlewares/auth"
import { authLimiter } from "../../infrastructure/rate-limiter"

const router = express.Router()

router.get("/google", authLimiter, getGoogleOAuthUrl)
router.get("/callback", getGoogleCallback)
router.get("/me", requireAuth, getUser)
//todo: save the /me user to redis with hset

export default router