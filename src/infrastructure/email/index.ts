import nodemailer from "nodemailer"
import { SMTP_EMAIL_PASS, SMTP_EMAIL_USER } from "../../config/env";
import logger from "../logger"

// Create a transporter using SMTP
const verifyConn = async () => {
    try {
        await transporter.verify();
        logger.info("Server is ready to take our messages");
    } catch (err) {
        logger.error("Verification failed:", err);
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