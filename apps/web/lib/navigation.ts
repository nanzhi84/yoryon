/** 共享站内返回路径校验，兑换/登录复用；拒绝协议相对、反斜杠和控制字符。 */
export function safeReturnTo(value: string | null | undefined): string | null {
  if (!value || value.length > 2048 || !value.startsWith("/") || value.startsWith("//") || /[\\\u0000-\u001f\u007f]/.test(value)) return null;
  try {
    const url = new URL(value, "https://return.invalid");
    let path = url.pathname;
    for (let i = 0; i < 3; i++) {
      if (path.startsWith("//") || /[\\\u0000-\u001f\u007f]/.test(path)) return null;
      const decoded = decodeURIComponent(path);
      if (decoded === path) break;
      path = decoded;
    }
    if (path.startsWith("//") || /[\\\u0000-\u001f\u007f]/.test(path) || url.origin !== "https://return.invalid") return null;
    return url.pathname + url.search + url.hash;
  } catch { return null; }
}
