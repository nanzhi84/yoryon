import * as React from "react";
import { Body, Head, Heading, Html, Link, Preview, Section, Text, render } from "react-email";
import { EMAIL_CODE_TTL_MS } from "@yoryon/config/constants";
import { EmailButton, EmailCard, EmailCardContent, EmailCardFooter, EmailCardHeader,
  EmailMutedText, EmailSeparator, emailTheme } from "./ui";

type Purpose = "register" | "password_reset";
const copy = {
  register: {
    subject: "【Yoryon】注册验证码", title: "验证你的邮箱", action: "完成注册",
    description: "欢迎来到 Yoryon。请返回刚才的注册页面，输入以下验证码，完成邮箱验证。",
    preview: "完成邮箱验证，开启你的 Yoryon 阅读旅程。", note: "如果不是你本人注册，请忽略这封邮件。",
  },
  password_reset: {
    subject: "【Yoryon】密码重置验证码", title: "重置你的密码", action: "重置密码",
    description: "我们收到了重置密码的请求。请返回刚才的重置密码页面，输入以下验证码并设置新密码。",
    preview: "使用一次性验证码安全地重置你的 Yoryon 密码。", note: "如果不是你本人发起，请忽略这封邮件。重置完成前，你的密码不会改变。",
  },
} as const;

function VerificationEmail({ code, purpose, siteUrl, minutes }: { code: string; purpose: Purpose; siteUrl: string; minutes: number }) {
  const content = copy[purpose];
  return (
    <Html lang="zh-CN">
      <Head><meta name="color-scheme" content="light" /></Head>
      <Preview>{content.preview}</Preview>
      <Body style={{ margin: "0", backgroundColor: emailTheme.muted, color: emailTheme.foreground,
        fontFamily: emailTheme.fontFamily, WebkitTextSizeAdjust: "100%" }}>
        <Section style={{ padding: "32px 12px" }}>
          <EmailCard>
            <EmailCardHeader>
              <Text style={{ margin: "0 0 4px", fontSize: "22px", fontWeight: 700, lineHeight: "28px", letterSpacing: "-0.5px" }}>Yoryon</Text>
              <EmailMutedText>账户通知</EmailMutedText>
              <EmailSeparator />
              <Heading as="h1" style={{ margin: "0 0 12px", fontSize: "24px", fontWeight: 600, lineHeight: "34px" }}>{content.title}</Heading>
            </EmailCardHeader>
            <EmailCardContent>
              <Text style={{ margin: "0 0 24px", fontSize: "14px", lineHeight: "25px", color: "#52525b" }}>{content.description}</Text>
              <Section style={{ backgroundColor: emailTheme.muted, border: `1px solid ${emailTheme.border}`,
                borderRadius: "8px", padding: "20px 12px", textAlign: "center" }}>
                <EmailMutedText>一次性验证码</EmailMutedText>
                <Text style={{ margin: "8px 0", fontFamily: '"SFMono-Regular", Menlo, Consolas, monospace',
                  fontSize: "36px", fontWeight: 600, lineHeight: "48px", letterSpacing: "5px" }}>{code}</Text>
                <EmailMutedText>{minutes} 分钟内有效 · 仅可使用一次</EmailMutedText>
              </Section>
              <Text style={{ margin: "16px 0 24px", fontSize: "12px", lineHeight: "20px", color: emailTheme.mutedForeground }}>请勿将验证码转发或提供给他人。</Text>
              <EmailButton href={siteUrl}>访问 Yoryon</EmailButton>
            </EmailCardContent>
            <EmailCardFooter><EmailMutedText>{content.note}</EmailMutedText></EmailCardFooter>
          </EmailCard>
          <Text style={{ margin: "20px 0 0", textAlign: "center", fontSize: "12px", lineHeight: "20px", color: emailTheme.mutedForeground }}>
            这是一封自动发送的邮件，请勿直接回复。<br />
            <Link href={siteUrl} style={{ color: emailTheme.mutedForeground, textDecoration: "underline" }}>Yoryon</Link>
          </Text>
        </Section>
      </Body>
    </Html>
  );
}

export async function buildVerificationEmail(code: string, purpose: Purpose, siteUrl: string) {
  if (!/^\d{6}$/.test(code)) throw new Error("mail_code_invalid");
  const site = new URL(siteUrl);
  if (!["http:", "https:"].includes(site.protocol) || site.username || site.password) throw new Error("mail_site_url_invalid");
  const minutes = EMAIL_CODE_TTL_MS / 60000;
  const content = copy[purpose];
  return {
    subject: content.subject,
    html: await render(<VerificationEmail code={code} purpose={purpose} siteUrl={site.origin} minutes={minutes} />),
    // Preserve the externally observable plain-text contract; the HTML is its MIME alternative.
    text: `你的验证码是 ${code}，${minutes} 分钟内有效，用于${content.action}。\n请在刚才的页面输入验证码，请勿提供给他人。\n${content.note}\n${site.origin}`,
  };
}
