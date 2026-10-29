export type SocialPlatform = "x" | "github" | "wechat" | "xiaohongshu" | "douyin";

export type SocialAccount = { platform: SocialPlatform; label: string } & (
  | { kind: "link"; href: string }
  | { kind: "copy"; name: string }
);

// Public profile destinations are maintained here, separately from the content export.
export const socialAccounts: readonly SocialAccount[] = [
  { platform: "x", label: "X", kind: "link", href: "https://x.com/yoryon_" },
  { platform: "github", label: "GitHub", kind: "link", href: "https://github.com/nanzhi84" },
  { platform: "wechat", label: "公众号", kind: "copy", name: "釉蓝yoryon" },
  {
    platform: "xiaohongshu",
    label: "小红书",
    kind: "link",
    href: "https://www.xiaohongshu.com/user/profile/649ade98000000001001d1dc",
  },
  {
    platform: "douyin",
    label: "抖音",
    kind: "link",
    href: "https://www.douyin.com/user/MS4wLjABAAAAKYi5Z7LC-1B1YgY8kYdN2DrKqwtdTvZ4I0lodLekyOs",
  },
];

for (const account of socialAccounts) {
  if (account.kind === "copy") {
    if (!account.name.trim()) throw new Error("社交账号名称不能为空");
    continue;
  }
  const url = new URL(account.href);
  if (url.protocol !== "https:" || url.username || url.password) {
    throw new Error("社交主页必须使用不含凭据的 HTTPS 地址");
  }
}
