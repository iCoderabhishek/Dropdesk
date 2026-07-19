import nodemailer from "nodemailer"
import { SMTP_EMAIL_PASS, SMTP_EMAIL_USER } from "../../config/env";

// Create a transporter using SMTP
const verifyConn = async () => {
    try {
        await transporter.verify();
        console.log("Server is ready to take our messages");
    } catch (err) {
        console.error("Verification failed:", err);
    }
}

const transporter = nodemailer.createTransport({
    service: "gmail",
    auth: {
        user: SMTP_EMAIL_USER,
        pass: SMTP_EMAIL_PASS,
    },
});


verifyConn();



export default transporter

// reference: https://nodemailer.com/