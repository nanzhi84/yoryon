# 生产部署验收记录 — 2026-10-12

状态：**前端、API 和数据库已部署并连通；真实 SMTP 仍待配置，不能宣称完整注册/找回密码已上线。** 用户已确认沿用现有 Hobby Team 的独立 `yoryon-web` 项目。未创建 Trial 或新增付费套餐。

## 当前入口与版本

- 网站：https://yoryon.com 、https://www.yoryon.com ；API：https://api.yoryon.com 。
- Vercel：Hobby Team `team_QZe9hRamSsGyB0AEDzsHIb5v`，项目 `prj_xqDwJzlRrfdQA63FIMeIsRpReaRP` / `yoryon-web`；计划 API 实测 `hobby`、`trial: null`。
- 生产部署：`dpl_FiYdKw4fRVg5mFstBcGto1FLeuxi`，`READY / PROMOTED`，绑定以上两个域名。[Vercel 部署](https://vercel.com/zyy2740738166-7111s-projects/yoryon-web/FiYdKw4fRVg5mFstBcGto1FLeuxi)。
- 前后端应用源码：`882221fb4405a08567e746c729af5868fa2e0110`；Next.js 15.5.27、Node 24。生产环境配置 `API_INTERNAL_URL`、`BFF_SHARED_SECRET`、`SITE_URL`、`ALLOWED_ORIGINS`、`FEED_REVALIDATE_SEC`，未给 Preview 注入生产凭据。
- 本地运维配置与验收提交：`7d39e947a398db357ec3e8be7c4add8cf9ad6296`，分支 `codex/production-neon-deployment`，**未推送**。业务应用代码没有变更；本次修复位于生产 Caddy 配置。
- Neon：新组织 `Yoryon Personal` / `org-orange-tooth-05992030`，项目 `yoryon-production` / `aged-leaf-22756272`；当前组织 API 实测 Free，Postgres 16，AWS 新加坡。
- Aliyun：实例 `30b9175a0c2e4508ba50c7b50c2994d3`，`8.222.152.17`；API 与 Caddy 健康，Cloudflare Free / DNS-only。仅该实例添加了已授权 SSH 公钥，私钥没有上传。
- API 镜像：`yoryon-api:882221fb-prod1`，manifest `sha256:bee56eeebffbff33df36460a7597916e905a31e919cb36196c9350b33df05b3e`。

项目配置独立，但 Hobby 用量仍受现有团队配额约束，不代表第二份独立免费额度。已购服务器、域名的续费成本不因使用免费托管计划而消失。

## 验收结果与复现

| 验证 | 结果 | 命令 / 证据 |
|---|---|---|
| 本地类型检查 | PASS，前一阶段结果 | `pnpm typecheck`；`typecheck.log` |
| 完整本地 E2E | 79/79 PASS，前一阶段结果 | `pnpm e2e`；`local-e2e.log` |
| 生产直连 API | 23/23 PASS，前一阶段、缓存修复前 | `node deploy/verify-production.mjs https://api.yoryon.com`；`production-api-acceptance.json` |
| 当前生产 BFF + 浏览器 | **46/46 PASS** | `node deploy/verify-production.mjs https://yoryon.com --browser`；`production-bff-acceptance.json`、`browser-*.png` |
| 双域名路由 | 12/12 PASS | `domain-cutover.json`；`curl --noproxy '*'`，根域与 www 的首页/API/关于/合集/robots/sitemap |
| www Origin 防护 | 2/2 PASS | `www-origin-checks.json`；合法 www 来源抵达登录验证，外部来源被拒绝 |
| 媒体缓存修复 | PASS | `media-cache-before.json`、`media-cache-after.json`、`vercel-cdn-purge.log`、BFF 报告 |
| 清理与最终首页 | PASS | `cleanup-after-bff.json` 七张业务表计数均 0；`homepage-after-cleanup.json` 两域名无验收内容 |
| 浏览器密钥边界 | PASS | `frontend-secret-scan.json`：首页 HTML 与所加载的 10 个 JS 文件没有配置密钥值 |
| 运行时错误扫描 | 返回 0 条 error | `runtime-error-scan.json`；限定当前 deployment 与记录中的 20 分钟窗口，并非持续监控 |
| 数据库与媒体备份恢复 | PASS，前一阶段结果 | `backup-restore.json`；校验 SHA256，隔离 Postgres 16 恢复，无生产覆盖 |
| 真实生产邮件投递 | **UNVERIFIED** | SMTP 缺失；本地 Mailpit 通过不能代替真实投递 |
| 公开正文静态化/预热 | **NOT IMPLEMENTED** | [Issue #6](https://github.com/nanzhi84/yoryon/issues/6) |

完整本地 E2E 前提：Node >=22、pnpm 11.8、Docker、ffmpeg，专用本地 PostgreSQL/Mailpit/媒体目录。不可把本地 E2E 配置改成生产数据库。

生产验收前提：本机 `~/.config/yoryon-production/secrets.json` 中受限 CLI 数据库连接、`admin@8.222.152.17` SSH 权限、服务器部署容器与已安装的 E2E Chromium。脚本通过服务器 CLI 发布唯一前缀的合成文章与图片，建立 active 测试账号，结束时只清理本轮数据。active 账号是夹具，**不代表生产邮箱注册成功**。当前浏览器验收包含 SMTP 缺失提示，SMTP 就绪后需调整此项为实际邮件投递验收。运行期间测试文章会短暂出现在公开信息流。

浏览器路径：公开全文与图片 → 付费墙且 HTML 无隐藏正文 → 表单登录与 Secure/HttpOnly Cookie → 表单兑换 → 全文/图片解锁 → 独立匿名会话仍锁定 → 撤权后付费墙 → 正文修改可见 → 公开转付费正文隐藏、媒体新请求 403 → 下线 404 → 退出会话失效。桌面 1280×900、移动视口 390×844，没有移动真机或 Safari 验收声明。当前 UI 无退出按钮，退出检查使用浏览器同源 BFF 请求。

## 本次发现并修复的生产缓存问题

第一次完整浏览器流程发现公开媒体鉴权跳转被 CDN 缓存：测试媒体已经删除后，API 返回 404，而相同 Vercel 路径仍返回 `302 / x-vercel-cache: HIT / age: 204 / public,max-age=300`。不能把此前直连 API 的通过当成 CDN 行为通过。

修复：生产 Caddy 对 `/api/media/*` 延迟覆盖响应头为 `private, no-store`，保留 SMTP 入口限制；验证配置后 reload，清除 **yoryon-web** 的 CDN 缓存。旧路径复查两端均为 404，Vercel 为 MISS；从头重跑后，文章转付费的新媒体请求为 403 / private,no-store / MISS，46 项全部通过。实现使用 [Caddy 延迟响应头覆盖](https://caddyserver.com/docs/caddyfile/directives/header)。

这会增加获取媒体跳转时的回源鉴权次数。Issue #6 的硬失效机制和真实 CDN 验收完成前不恢复此缓存。已下载的文件无法召回，已经签发的 URL 仍按原有 900 秒期限有效；本修复没有承诺撤销读者已有副本。原失败记录保留在 `production-bff-before-cache-fix.json`；attempt1/2 为验收选择器碰到 Next.js 辅助提示节点导致的失败，后续已收窄到 main 内。

## 仍待完成

1. 生产 SMTP 服务、发信地址及安全凭据位置。当前注册、重发验证码、找回密码返回明确的 `503 mail_not_configured`，不创建无法激活的账号；浏览器提示已验证。配置后必须做真实收件、验证码激活与密码重置，再移除临时限制。
2. 用户实际文章尚未发布，生产业务数据为空。
3. Issue #6 的公开正文静态化、发布/修改预热和自动缓存撤销待实现；当前文章详情仍动态鉴权。

## 运维与恢复

部署说明：`deploy/README.neon.md`；架构决策：`docs/adr/0008-free-plan-production.md`。数据库角色分离，API 使用池化连接且无 DDL 权限，CLI 与迁移使用各自直连角色。媒体位于服务器持久目录，API 只读、CLI 发布可写；当前完整读取媒体的实现尚不适合大视频或高并发。

每日 04:17（UTC+8）服务器备份，保留 7 天；此前已下载一份到本机受限目录并恢复验证。同机备份不能防整机丢失，应另存独立设备。密钥仅在本机受限配置目录和服务器 `/etc/yoryon/`，没有进入 Git 或工件；截图不保存密码、验证码、激活码，未录制含凭据的 trace。

应用回滚：保留镜像，修改 `/opt/yoryon/.env` 的 `YORYON_IMAGE`，再执行 `sudo docker compose -f compose.neon.yml up -d --wait`，迁移兼容性独立评估。Caddy 本次修改前备份为 `/opt/yoryon/Caddyfile.before-media-cache-fix`；SMTP gate 位于服务器配置中，仓库版本作为邮件就绪后的目标配置。不要为回滚恢复已确认存在缺陷的公开媒体 302 缓存。

目录 `SHA256SUMS` 覆盖最终工件，可在此目录执行 `shasum -a 256 -c SHA256SUMS` 校验。
