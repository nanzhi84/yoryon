/**
 * 共享常量：API、CLI、Web 三方一致的业务常量。
 * 仅放真正的常量；涉及环境差异的值一律走环境变量（见 env.ts）。
 */

/** 会话有效期（毫秒）：30 天 */
export const SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000;
/** 剩余有效期低于该值时滑动续期（毫秒）：15 天 */
export const SESSION_RENEW_BELOW_MS = 15 * 24 * 60 * 60 * 1000;
/** lastUsedAt 写入节流（毫秒）：距上次记录低于该间隔则不写库，消除高频请求的写放大（F05a） */
export const SESSION_TOUCH_MIN_INTERVAL_MS = 60 * 1000;
/** Session Cookie 名称（host-only，BFF 设置） */
export const SESSION_COOKIE = "yoryon_session";

/** 邮箱验证码：6 位数字 */
export const EMAIL_CODE_LENGTH = 6;
/** 验证码有效期（毫秒）：10 分钟 */
export const EMAIL_CODE_TTL_MS = 10 * 60 * 1000;
/** 重发冷却（毫秒）：60 秒 */
export const EMAIL_CODE_RESEND_COOLDOWN_MS = 60 * 1000;
/** 单码最大尝试次数 */
export const EMAIL_CODE_MAX_ATTEMPTS = 5;

/** 媒体签名 URL TTL（秒）：15 分钟（ADR-0006） */
export const MEDIA_SIGN_TTL_SEC = 900;
/** 免费媒体 302 共享缓存 max-age（秒），必须 < MEDIA_SIGN_TTL_SEC（ADR-0003） */
export const MEDIA_FREE_CACHE_MAX_AGE_SEC = 300;
/** 媒体字节响应的私有缓存（上传时写入对象元数据）：7 天 */
export const MEDIA_BYTES_CACHE_CONTROL = "private, max-age=604800";

/** 预览截断：媒体块等价字符权重（ADR §6.2，可配置见 env MEDIA_BLOCK_WEIGHT） */
export const DEFAULT_MEDIA_BLOCK_WEIGHT = 300;

/** GC：孤儿对象宽限期（毫秒）：24 小时 */
export const GC_ORPHAN_GRACE_MS = 24 * 60 * 60 * 1000;
/** GC：零引用资产宽限期（毫秒）：7 天 */
export const GC_ZERO_REF_GRACE_MS = 7 * 24 * 60 * 60 * 1000;
/** 发布 / GC 互斥的 advisory lock 名称（hashtextextended 的输入） */
export const PUBLISH_GC_LOCK_NAME = "yoryon.media_publish_gc";

/** OSS 对象键前缀 */
export const MEDIA_KEY_PREFIX = "media/";

/** 限流阈值（单实例内存令牌桶，ADR-0001 §9.5） */
export const RATE_LIMITS = {
  loginPerIpPerMinute: 5,
  loginPerAccountPer5Min: 5,
  registerPerIpPerHour: 3,
  resendCooldownMs: EMAIL_CODE_RESEND_COOLDOWN_MS,
  redeemPerUserPerMinute: 10,
  redeemPerIpPerMinute: 20,
  passwordResetPerIpPerHour: 3,
  passwordResetPerAccountPerHour: 3,
  /** analytics 批量 ingest：每 IP 每分钟批次数（每批 ≤ ANALYTICS_MAX_BATCH 事件） */
  analyticsBatchPerIpPerMinute: 60,
} as const;

/** analytics 单批事件上限（ADR-0007） */
export const ANALYTICS_MAX_BATCH = 20;

export type RateLimitName = keyof typeof RATE_LIMITS;
