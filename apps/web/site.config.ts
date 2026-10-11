/**
 * 站点资料配置：/about 关于页（头像、名字、简介、社交账号）。
 * 头像图片放在 apps/web/public/profile/ 下并在此引用（如 /profile/avatar.png）；
 * 未配置时退化为首字母占位。
 */
export const site = {
  name: "Yoryon",
  /** 简介（支持多段，占位文案，随时替换） */
  bioLines: [
    "记录文章、图片、视频与音频。",
    "这里是一段更长的个人简介占位：可以介绍你是谁、在写什么、为什么写，以及这个博客的更新节奏和付费内容的取向。",
    "也可以补充你的经历、兴趣与联系方式，让读者更了解你。所有文案都在 site.config.ts 里修改。",
  ] as string[],
  avatar: null as string | null,
  links: [
    { label: "GitHub", href: "https://github.com/yoryon" },
    { label: "X", href: "https://x.com/yoryon" },
    { label: "Bilibili", href: "https://space.bilibili.com" },
    { label: "Email", href: "mailto:hi@yoryon.me" },
  ] as { label: string; href: string }[],
};
