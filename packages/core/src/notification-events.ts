import { createHash } from "node:crypto";

/** 事件业务键派生 UUID；唯一索引使重复写入保持幂等。 */
export function deterministicUuid(businessKey: string): string {
  const h = createHash("sha256").update(businessKey).digest();
  h[6] = (h[6]! & 0x0f) | 0x50;
  h[8] = (h[8]! & 0x3f) | 0x80;
  const hex = h.subarray(0, 16).toString("hex");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}
