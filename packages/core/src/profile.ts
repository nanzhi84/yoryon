/** 公开展示资料投影；登录标识保持独立，展示资料不复制到历史互动记录。 */
export function toAuthorDto(u: { username: string; displayName: string | null; avatarMediaId: string | null }) {
  return {
    username: u.username,
    displayName: u.displayName ?? u.username,
    avatarUrl: u.avatarMediaId ? `/api/avatars/${u.avatarMediaId}` : null,
  };
}

/** Unicode 码点长度；拒绝控制字符、双向格式标记和 HTML 敏感字符。 */
export function validDisplayName(value: unknown): value is string {
  return typeof value === "string" && [...value.trim()].length >= 1 && [...value.trim()].length <= 40
    && !/[\p{Cc}\p{Cf}<>]/u.test(value);
}
