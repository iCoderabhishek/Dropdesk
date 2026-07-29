import type { Request, Response } from "express";
import transporter from "./index"
import { SMTP_EMAIL_USER } from "../../config/env";
import nodemailer from "nodemailer"
import logger from "../logger"

export const sendInviteEmail = async (email: string, workspaceName: string, inviteLink: string): Promise<void> => {
    try {
        const msg = await transporter.sendMail({
            from: SMTP_EMAIL_USER,
            to: email,
            subject: "Invitation to workspace from dropdesk",
            html: `
      <p>You have been invited to join the workspace "${workspaceName}".</p>
      <p>Click the link below to accept the invitation:</p>
      <a style="cursor: pointer; text-decoration: none; color: #3b82f6;" href="${inviteLink}">Accept Invitation</a>

      <p> If you dont accept the invite it will expire in 7 days </p>

      <br/>

      <p> Made with ꨄ︎ by Abhishek</p>
      <br/>
    `

        })

        logger.info("Message sent: %s", msg.messageId);
        // Preview URL is only available when using an Ethereal test account
        logger.info("Preview URL: %s", nodemailer.getTestMessageUrl(msg));

    } catch (error) {
        logger.error("Error while sending mail:", error);
    }

}


// thanks to nodemailer doc ..