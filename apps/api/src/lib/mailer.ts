import nodemailer from "nodemailer";
import { env } from "../config/env.js";
import { logger } from "./logger.js";

const transporter =
  env.EMAIL_PROVIDER === "smtp"
    ? nodemailer.createTransport({
        host: env.SMTP_HOST,
        port: env.SMTP_PORT,
        auth: env.SMTP_USER ? { user: env.SMTP_USER, pass: env.SMTP_PASSWORD } : undefined,
      })
    : null;

export async function sendOtpEmail(to: string, code: string, documentTitle: string): Promise<void> {
  if (!transporter) {
    // Provider "console" : pratique en développement, jamais utilisé en prod.
    logger.info({ to, documentTitle }, `[dev] Code OTP pour ${to} : ${code}`);
    return;
  }

  await transporter.sendMail({
    from: env.SMTP_FROM,
    to,
    subject: `Votre code de vérification SecureView — ${documentTitle}`,
    text: `Votre code de vérification est : ${code}\n\nCe code expire dans ${Math.round(env.OTP_TTL_SECONDS / 60)} minutes.\n\nSi vous n'êtes pas à l'origine de cette demande, ignorez cet email.`,
  });
}
