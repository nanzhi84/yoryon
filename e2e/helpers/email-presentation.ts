/** Render actual SMTP HTML with JS disabled. Persist only a nonfunctional preview code. */
import { expect, type Browser } from "@playwright/test";
import fs from "node:fs/promises";
import path from "node:path";
import { E2E } from "./env";
import { latestVerificationMailFor } from "./mailpit";

export async function verifyEmailPresentation(browser: Browser, email: string, purpose: "register" | "password_reset") {
  const mail = await latestVerificationMailFor(email);
  const title = purpose === "register" ? "验证你的邮箱" : "重置你的密码";
  // HTML must carry the same usable code as the plain-text MIME alternative.
  expect(mail.HTML.length > 0, "SMTP includes an HTML alternative").toBe(true);
  expect(mail.HTML.includes(mail.code), "HTML and plain-text verification code agree").toBe(true);
  expect(/<script|<form|<iframe|<input|<img[\s>]/i.test(mail.HTML), "no scripts, forms or external images").toBe(false);
  expect(/oklch\(|var\(--/i.test(mail.HTML), "email styles require no CSS variables or modern color functions").toBe(false);
  expect(Buffer.byteLength(mail.HTML) < 50000, "bounded transactional email size").toBe(true);
  const html = mail.HTML.split(mail.code).join("000000");
  const text = mail.Text.split(mail.code).join("000000");
  const artifactDir = path.resolve(import.meta.dirname, "../../artifacts/email-html-20261012");
  await fs.mkdir(artifactDir, { recursive: true });
  const checks = ["html_and_text_same_code", "no_active_content_or_external_images", "email_compatible_colors", "under_50kb"];
  const context = await browser.newContext({ javaScriptEnabled: false });
  try {
    const page = await context.newPage();
    const requests: string[] = [];
    await page.route("**/*", async route => { requests.push("external request"); await route.abort(); });
    for (const [name, width] of [["desktop", 800], ["mobile", 320]] as const) {
      await page.setViewportSize({ width, height: 900 });
      await page.setContent(html);
      await expect(page.getByRole("heading", { name: title, exact: true })).toBeVisible();
      await expect(page.getByText("000000", { exact: true })).toBeVisible();
      await expect(page.getByText(/10 分钟/)).toBeVisible();
      const action = page.getByRole("link", { name: "访问 Yoryon", exact: true });
      await expect(action).toBeVisible();
      await expect(action).toHaveAttribute("href", new URL(E2E.webUrl).origin);
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), `${name} has no horizontal overflow`).toBe(true);
      await page.screenshot({ path: path.join(artifactDir, `${purpose}-${name}.png`), fullPage: true });
      checks.push(`${name}_readable_without_javascript`, `${name}_no_horizontal_overflow`, `${name}_safe_website_link`);
    }
    expect(requests.length, "rendering requires zero external requests").toBe(0);
    checks.push("zero_external_requests");
    await fs.writeFile(path.join(artifactDir, `${purpose}.html`), html);
    await fs.writeFile(path.join(artifactDir, `${purpose}.txt`), text);
    await fs.writeFile(path.join(artifactDir, `${purpose}-acceptance.json`), JSON.stringify({
      purpose, status: "PASS", source: "actual_local_registration_or_reset_smtp_delivery", checks,
      htmlBytes: Buffer.byteLength(mail.HTML), previewCode: "nonfunctional_placeholder", widths: [800, 320],
    }, null, 2) + "\n");
  } finally { await context.close(); }
  return mail.code;
}
