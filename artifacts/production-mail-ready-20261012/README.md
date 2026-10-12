# SMTP 开放后的生产 BFF / 浏览器验收

`production-bff-acceptance.json`：**46/46 PASS**，Chromium 新上下文，桌面 1280 px / 窄屏视口 390 px。覆盖公开/付费阅读、媒体授权与 Range、激活码兑换、撤权、公开修改、转付费、下线、登出和可用注册表单；最后合成账号/文章/媒体清理通过。

```sh
node deploy/verify-production.mjs https://yoryon.com --browser --smtp-ready
```

环境与数据前提见 `deploy/README.neon.md`。生产 API 为 `yoryon-api:882221fb-prod1`，前端既有 `yoryon-web` 部署 `dpl_FiYdKw4fRVg5mFstBcGto1FLeuxi`。本脚本不发邮件、不把直接建立的夹具账号当作注册验收；真实注册/重置收件见 `../directmail-20261012/real-mail-acceptance.json`。截图不包含密码、令牌、激活码或真实收件人。

转付费媒体返回 403、`private, no-store`、Vercel `MISS`。公开正文依然动态，Issue #6 未实现。390 px 是桌面 Chromium 窄屏模拟，不是物理手机、微信或 Safari/Outlook 验收。
