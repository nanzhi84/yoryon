/**
 * 邮件发送（nodemailer SMTP；生产 DirectMail，开发 Mailpit —— 一套代码）。
 * 日志与内容均不得包含密码；验证码只出现在邮件正文中。
 */
import nodemailer, { type Transporter } from "nodemailer";
import type { ApiEnv } from "@yoryon/config";
import { buildVerificationEmail } from "./email/verification";

export interface Mailer {
  sendVerificationCode(to: string, code: string, purpose: "register" | "password_reset", siteUrl: string): Promise<void>;
}

export function createMailer(env: Pick<ApiEnv, "MAIL_SMTP_HOST" | "MAIL_SMTP_PORT" | "MAIL_SMTP_USER" | "MAIL_SMTP_PASS" | "MAIL_FROM">): Mailer {
  const transporter: Transporter = nodemailer.createTransport({
    host: env.MAIL_SMTP_HOST,
    port: env.MAIL_SMTP_PORT,
    secure: env.MAIL_SMTP_PORT === 465,
    ...(env.MAIL_SMTP_USER ? { auth: { user: env.MAIL_SMTP_USER, pass: env.MAIL_SMTP_PASS ?? "" } } : {}),
  });

  return {
    async sendVerificationCode(to, code, purpose, siteUrl) {
      const message = await buildVerificationEmail(code, purpose, siteUrl);
      await transporter.sendMail({
        from: env.MAIL_FROM,
        to,
        ...message,
      });
    },
  };
}
