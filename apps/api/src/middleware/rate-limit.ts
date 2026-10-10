/**
 * 单实例内存令牌桶限流（ADR-0001 §9.5）。
 * 边界：仅保证单实例一致性——重启清零、多实例各自计数；v1 单实例部署可接受。
 */
export class RateLimiter {
  private buckets = new Map<string, { tokens: number; refillAt: number }>();
  private maxKeys: number;

  constructor(maxKeys = 50_000) {
    this.maxKeys = maxKeys;
  }

  /**
   * 尝试消费 1 个令牌。
   * @returns null 表示放行；否则返回需等待的秒数。
   */
  consume(key: string, limit: number, windowMs: number): number | null {
    const now = Date.now();
    let b = this.buckets.get(key);
    if (!b) {
      if (this.buckets.size >= this.maxKeys) this.evict(now);
      b = { tokens: limit, refillAt: now + windowMs };
      this.buckets.set(key, b);
    } else if (now >= b.refillAt) {
      b.tokens = limit;
      b.refillAt = now + windowMs;
    }
    if (b.tokens <= 0) return Math.ceil((b.refillAt - now) / 1000);
    b.tokens -= 1;
    return null;
  }

  private evict(now: number) {
    for (const [k, v] of this.buckets) {
      if (now >= v.refillAt) this.buckets.delete(k);
    }
    if (this.buckets.size >= this.maxKeys) this.buckets.clear();
  }
}
