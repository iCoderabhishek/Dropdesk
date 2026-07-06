import { Request, Response } from "express";
import transporter from "./index"
import { SMTP_EMAIL_USER } from "../../config/env";
import nodemailer from "nodemailer"

export const sendInviteEmail = async (email: string, workspaceName: string, inviteLink: string) => {
    try {
        const msg = await transporter.sendMail({
            from: SMTP_EMAIL_USER,
            to: email,
            subject: "Invitation to workspace from dropdesk",
            html: `
      <p>You have been invited to join the workspace "${workspaceName}".</p>
      <p>Click the link below to accept the invitation:</p>
      <a href="${inviteLink}">Accept Invitation</a>


      <br/>

      <p> made withㅤꨄ︎ by Abhishek</p>
      <br/>
    `

        })

        console.log("Message sent: %s", msg.messageId);
        // Preview URL is only available when using an Ethereal test account
        console.log("Preview URL: %s", nodemailer.getTestMessageUrl(msg));

    } catch (error) {
        console.error("Error while sending mail:", error);
    }

}


// thanks to nodemailer doc ..