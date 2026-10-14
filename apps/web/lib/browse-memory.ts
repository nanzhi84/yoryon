export const BROWSE_LAYOUT_READY = "yoryon:browse-layout-ready";
/** 本标签页只记浏览元数据与公开列表；不保存正文命中或已授权全文。 */
const prefix = "yoryon:browse:";
export function readBrowse<T>(key: string): T | null {
  try { const raw = sessionStorage.getItem(prefix + key); return raw ? JSON.parse(raw) as T : null; }
  catch { return null; } // 浏览器禁用存储时退回原生history，不影响页面阅读。
}
export function writeBrowse(key: string, value: unknown) {
  try { sessionStorage.setItem(prefix + key, JSON.stringify(value)); } catch { /* 可选浏览记忆不可阻止导航。 */ }
}
export function clearSearchMemory() {
  // 留下空记录，BFCache恢复的旧搜索页也能识别身份切换后的清理。
  writeBrowse("search", { query: "", request: null, session: null, offsets: [] });
}
export function currentBrowsePath() { return location.pathname + location.search; }
export function rememberPosition(path = currentBrowsePath(), y = scrollY) {
  const positions = readBrowse<Record<string, { y: number; time: number }>>("positions") ?? {};
  positions[path] = { y, time: Date.now() };
  const sorted = Object.entries(positions).sort((a, b) => b[1].time - a[1].time).slice(0, 40);
  writeBrowse("positions", Object.fromEntries(sorted));
}
