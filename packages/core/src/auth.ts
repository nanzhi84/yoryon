/**
 * 认证原语：密码哈希（argon2id）、会话令牌、邮箱验证码。
 * 令牌/验证码只存哈希，明文只出现在响应/邮件中（架构 §5、§9.3）。
 */
import { createHash, randomInt, randomBytes, timingSafeEqual } from "node:crypto";
import argon2 from "argon2";

export async function hashPassword(password: string): Promise<string> {
  return argon2.hash(password, { type: argon2.argon2id });
}

export async function verifyPassword(hash: string, password: string): Promise<boolean> {
  try {
    return await argon2.verify(hash, password);
  } catch {
    return false;
  }
}

export function sha256Hex(input: string): string {
  return createHash("sha256").update(input).digest("hex");
}

/** 生成会话令牌：32 字节随机，库中存 sha256。 */
export function generateSessionToken(): { token: string; tokenHash: string } {
  const token = randomBytes(32).toString("base64url");
  return { token, tokenHash: sha256Hex(token) };
}

export function hashSessionToken(token: string): string {
  return sha256Hex(token);
}

/**
 * 生成 6 位数字验证码。哈希绑定 email+purpose，防止跨场景重放。
 */
export function generateEmailCode(email: string, purpose: string): { code: string; codeHash: string } {
  const code = randomInt(0, 1_000_000).toString().padStart(6, "0");
  return { code, codeHash: hashEmailCode(email, purpose, code) };
}

export function hashEmailCode(email: string, purpose: string, code: string): string {
  return sha256Hex(`${purpose}:${email.toLowerCase()}:${code}`);
}

export function safeEqualHex(a: string, b: string): boolean {
  const ba = Buffer.from(a, "hex");
  const bb = Buffer.from(b, "hex");
  return ba.length === bb.length && timingSafeEqual(ba, bb);
}
