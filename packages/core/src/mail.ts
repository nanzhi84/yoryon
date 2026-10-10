/**
 * 邮件发送（nodemailer SMTP；生产 DirectMail，开发 Mailpit —— 一套代码）。
 * 日志与内容均不得包含密码；验证码只出现在邮件正文中。
 */
import nodemailer, { type Transporter } from "nodemailer";
import type { ApiEnv } from "@yoryon/config";

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
      const subject = purpose === "register" ? "【Yoryon】注册验证码" : "【Yoryon】密码重置验证码";
      const action = purpose === "register" ? "完成注册" : "重置密码";
      await transporter.sendMail({
        from: env.MAIL_FROM,
        to,
        subject,
        text: `你的验证码是 ${code}，10 分钟内有效，用于${action}。\n如果不是本人操作，请忽略本邮件。\n${siteUrl}`,
      });
    },
  };
}
