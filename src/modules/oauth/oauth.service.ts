import type { Request, Response } from "express";
import axios from "axios";
import { CLIENT_ID, CLIENT_SECRET, REDIRECT_URI } from "../../config/env";

export const getGoogleOAuthUrl = (req: Request, res: Response) => {
    const url = `https://accounts.google.com/o/oauth2/v2/auth?client_id=${CLIENT_ID}&redirect_uri=${REDIRECT_URI}&response_type=code&scope=profile email`;
    return res.redirect(url);
}

export const getGoogleCallback = async (req: Request, res: Response) => {
    const { code } = req.query

    if (!code || typeof code !== "string") {
        return res.status(400).send("Code is required")
    }
    try {
        const { data } = await axios.post("https://oauth2.googleapis.com/token", {
            client_id: CLIENT_ID,
            client_secret: CLIENT_SECRET,
            code,
            redirect_uri: REDIRECT_URI,
            grant_type: "authorization_code"
        })
        const { access_token } = data
        const { data: profile } = await axios.get("https://www.googleapis.com/oauth2/v2/userinfo", {
            headers: {
                Authorization: `Bearer ${access_token}`
            }
        })
        console.log(profile);
        res.cookie("auth_token", access_token as string, {
            httpOnly: true,
            secure: true,
            sameSite: "none", //todo will change it to strict - https://datatracker.ietf.org/doc/html/draft-ietf-httpbis-cookie-same-site-00#section-4.1.1
            maxAge: 1000 * 60 * 60 * 24 * 7 // 1 week
        })

        //todo to save user to pg after verified

        return res.redirect("/")
    } catch (error) {
        if (axios.isAxiosError(error)) {
            console.log(error.response?.data)
        }
        console.log(error);

        res.status(500).json({ message: "google auth failed, try again" })
    }
}

export const getUser = (req: Request, res: Response) => {
    const { user } = req.user
    return res.json({ user })
}