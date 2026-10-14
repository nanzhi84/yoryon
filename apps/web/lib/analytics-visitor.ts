"use client";

const COOKIE_NAME = "yoryon_analytics_vid";
const COOKIE_MAX_AGE = 180 * 24 * 60 * 60;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
let preparation: Promise<void> | null = null;
let cookieUnavailable = false;

export function analyticsDisabled(): boolean {
  if (typeof navigator === "undefined") return true;
  const nav = navigator as Navigator & { globalPrivacyControl?: boolean };
  return nav.doNotTrack === "1" || nav.globalPrivacyControl === true;
}

/** Cookie 始终是身份来源；不缓存 UUID，避免不同标签页长期沿用竞态产生的编号。 */
export function readVisitorId(): string | null {
  if (analyticsDisabled()) return null;
  try {
    const value = document.cookie.split(";").map((part) => part.trim())
      .find((part) => part.startsWith(`${COOKIE_NAME}=`))?.slice(COOKIE_NAME.length + 1);
    return value && UUID.test(value) ? value.toLowerCase() : null;
  } catch {
    cookieUnavailable = true;
    return null;
  }
}

function createVisitorCookie(): void {
  if (analyticsDisabled() || readVisitorId() || cookieUnavailable) return;
  try {
    // 不设置 Domain；不在复用时写 Cookie，180 天从首次创建起算。
    document.cookie = `${COOKIE_NAME}=${crypto.randomUUID()}; Max-Age=${COOKIE_MAX_AGE}; Path=/; SameSite=Lax; Secure`;
    if (!readVisitorId()) cookieUnavailable = true;
  } catch {
    cookieUnavailable = true;
  }
}

/** 只在需要真实采集时初始化，Cookie 被禁用后不逐事件生成新编号。 */
export function prepareVisitorIdentity(): Promise<void> {
  if (analyticsDisabled() || readVisitorId() || cookieUnavailable) return Promise.resolve();
  if (preparation) return preparation;
  if (!navigator.locks) {
    createVisitorCookie();
    return Promise.resolve();
  }
  const abort = new AbortController();
  const timer = window.setTimeout(() => abort.abort(), 1_500);
  preparation = navigator.locks.request("yoryon-analytics-visitor", { signal: abort.signal }, createVisitorCookie)
    .catch(() => {
      // 锁不可用/等待超时仍允许缺省身份采集。下次事件可重试，绝不阻塞页面。
    })
    .finally(() => {
      window.clearTimeout(timer);
      preparation = null;
    });
  return preparation;
}

export function visitorPreparation(): Promise<void> | null {
  return preparation;
}
