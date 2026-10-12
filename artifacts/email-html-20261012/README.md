# HTML 账户邮件验收与预览

注册、密码重置使用同一组邮件组件，沿用网站 shadcn/ui 的 Zinc 配色与中文系统字体。React Email 在服务器生成带内联样式的 HTML，Nodemailer 同时发送 HTML 与纯文本。详情见 `docs/adr/0009-transactional-email.md`。

```sh
pnpm install --frozen-lockfile
pnpm typecheck
pnpm --filter @yoryon/e2e test auth.spec.ts
```

前提：Node >=22、Docker、ffmpeg、项目 Chromium 已安装。本地固定的 Docker PostgreSQL/Mailpit，禁止替换成生产连接；pretest 构建真实 Next.js，globalSetup 重置隔离数据库及测试存储。

`auth-e2e-summary.json`：6/6 认证用户路径通过。两类邮件是注册/重置 API 经实际 SMTP 投递到 Mailpit 的内容，分别检查 HTML/纯文本验证码一致、无脚本/表单/外部图片/CSS 变量、体积 <50 KB，以及 JS 关闭、外部请求全部拦截下 800px/320px 的标题、验证码、期限、链接、零横向溢出，共 22 项呈现断言通过。对应 `*-acceptance.json`。

`register.html` / `password_reset.html`、纯文本与四张布局截图来自实际收到的模板；真实验证码在写工件前全部替换为不可用的 `000000`，不是测试或生产验证码。HTML 中的链接为本地 E2E 站点，用于验证配置 origin，不是最终生产链接。

`initial-attempts.json` 保留已修复的依赖解析/JSX 运行错误摘要，不收录原始日志、trace 或验证码。Chromium 仅证明该布局，Outlook、Apple Mail 与物理手机客户端未实测。生产真实 HTML MIME 收件另行验证，不能以本地 SMTP 或截图替代。
