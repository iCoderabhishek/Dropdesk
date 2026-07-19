import type { NextFunction, Request, Response } from "express";

export const requireAuth = async (req: Request, res: Response, next: NextFunction) => {

    if (!req.session || !req.session.access_token) {
        return res.status(401).json({ message: "Unauthorized: No valid session found" })
    }


    req.user = {
        access_token: req.session.access_token,
        userId: req.session.userId
    }

    next()
}