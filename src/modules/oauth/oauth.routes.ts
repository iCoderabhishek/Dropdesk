import express from "express"
import { getGoogleCallback, getGoogleOAuthUrl, getUser } from "./oauth.service"
import { requireAuth } from "../../api/middlewares/auth"

const router = express.Router()

router.get("/google", getGoogleOAuthUrl)
router.get("/callback", getGoogleCallback)
router.get("/me", requireAuth, getUser)

export default router