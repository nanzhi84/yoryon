import { createHmac, timingSafeEqual } from "node:crypto";

export function cacheSignature(secret: string, time: string, body: string) {
  return createHmac("sha256", secret).update(`${time}.${body}`).digest("hex");
}
export function verifyCacheSignature(secret: string | undefined, time: string | null, signature: string | null, body: string) {
  if (!secret || secret.length < 32 || !time || !signature || !/^\d{13}$/.test(time) || Math.abs(Date.now() - Number(time)) > 60_000 || !/^[a-f0-9]{64}$/.test(signature)) return false;
  return timingSafeEqual(Buffer.from(signature, "hex"), Buffer.from(cacheSignature(secret, time, body), "hex"));
}
