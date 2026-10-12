/** Mailpit HTTP API 辅助：读取验证码邮件。 */
import { E2E } from "./env";

interface MailpitMessage {
  ID: string;
  To: { Address: string }[];
  Subject: string;
}

export async function clearMailpit(): Promise<void> {
  await fetch(`${E2E.mailpitApiUrl}/api/v1/messages`, { method: "DELETE" });
}

export interface VerificationMail {
  Subject: string;
  Text: string;
  HTML: string;
  code: string;
}

export async function latestVerificationMailFor(email: string, timeoutMs = 10_000): Promise<VerificationMail> {
  const deadline = Date.now() + timeoutMs;
  for (;;) {
    const res = await fetch(`${E2E.mailpitApiUrl}/api/v1/messages?limit=200`);
    const data = (await res.json()) as { messages: (MailpitMessage & { Created: string })[] };
    const msg = data.messages
      .filter((m) => m.To.some((t) => t.Address.toLowerCase() === email.toLowerCase()))
      .sort((a, b) => (a.Created < b.Created ? 1 : -1))[0];
    if (msg) {
      const full = await fetch(`${E2E.mailpitApiUrl}/api/v1/message/${msg.ID}`);
      const body = (await full.json()) as Omit<VerificationMail, "code">;
      const m = /验证码是 (\d{6})/.exec(body.Text);
      if (m) return { ...body, code: m[1]! };
    }
    if (Date.now() > deadline) throw new Error(`未收到 ${email} 的验证码邮件`);
    await new Promise((r) => setTimeout(r, 300));
  }
}

export async function latestCodeFor(email: string, timeoutMs = 10_000): Promise<string> {
  return (await latestVerificationMailFor(email, timeoutMs)).code;
}
