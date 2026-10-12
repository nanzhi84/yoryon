/** Email adaptations of shadcn/ui's composition and the site's Zinc theme (ADR-0009).
 * React Email supplies table layout and Outlook-safe buttons; styles are inline.
 * Keep this boundary independent from Next.js/Radix and browser-only CSS tokens.
 */
import type { ReactNode } from "react";
import * as React from "react";
import { Button, Container, Hr, Section, Text } from "react-email";

export const emailTheme = {
  background: "#ffffff", foreground: "#09090b", muted: "#f4f4f5",
  mutedForeground: "#71717a", border: "#e4e4e7",
  fontFamily: '-apple-system, BlinkMacSystemFont, "PingFang SC", "Hiragino Sans GB", "Microsoft YaHei", "Noto Sans SC", "Segoe UI", sans-serif',
} as const;

export function EmailCard({ children }: { children: ReactNode }) {
  return <Container style={{ width: "100%", maxWidth: "520px", backgroundColor: emailTheme.background,
    border: `1px solid ${emailTheme.border}`, borderRadius: "12px", margin: "0 auto" }}>{children}</Container>;
}

export function EmailCardHeader({ children }: { children: ReactNode }) {
  return <Section style={{ padding: "28px 28px 0" }}>{children}</Section>;
}

export function EmailCardContent({ children }: { children: ReactNode }) {
  return <Section style={{ padding: "0 28px 28px" }}>{children}</Section>;
}

export function EmailCardFooter({ children }: { children: ReactNode }) {
  return <Section style={{ padding: "20px 28px", backgroundColor: emailTheme.muted,
    borderTop: `1px solid ${emailTheme.border}`, borderRadius: "0 0 12px 12px" }}>{children}</Section>;
}

export function EmailButton({ href, children }: { href: string; children: ReactNode }) {
  return <Button href={href} style={{ backgroundColor: emailTheme.foreground, color: emailTheme.background,
    borderRadius: "6px", fontSize: "14px", fontWeight: 500, lineHeight: "20px", padding: "12px 20px",
    textAlign: "center", textDecoration: "none" }}>{children}</Button>;
}

export function EmailMutedText({ children }: { children: ReactNode }) {
  return <Text style={{ color: emailTheme.mutedForeground, fontSize: "12px", lineHeight: "20px", margin: "0" }}>{children}</Text>;
}

export function EmailSeparator() {
  return <Hr style={{ border: "none", borderTop: `1px solid ${emailTheme.border}`, margin: "24px 0" }} />;
}
