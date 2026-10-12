/** 已读状态或登录身份变更后通知入口重新读取私有计数，事件不携带用户数据。 */
export const NOTIFICATIONS_CHANGED = "yoryon:notifications-changed";

export function notifyNotificationsChanged() {
  window.dispatchEvent(new Event(NOTIFICATIONS_CHANGED));
}
