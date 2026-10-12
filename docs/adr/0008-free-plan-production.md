# ADR-0008：Neon Free 与已有服务器上的生产部署

日期：2026-10-12。约束：Neon、Cloudflare、Vercel 只用免费计划；已购域名、服务器仍有续费成本。用户另行明确批准 DirectMail 用完免费额度后按量计费并开放注册/找回密码，不将邮件服务描述为永久免费。

## 边界与数据流

浏览器 → Vercel Next.js BFF → HTTPS api.yoryon.com → Caddy → Hono → Neon Postgres。
前端不持有数据库凭证。API 使用独立、无 DDL 权限的数据库角色；迁移与 CLI 使用各自直连角色。
Neon 新组织 Yoryon Personal，项目 yoryon-production，AWS 新加坡、Postgres 16、Free。
应用使用池化连接；CLI 的 session advisory lock 与迁移使用直连。

Vercel 经用户确认继续使用现有 Hobby Team 下的独立 `yoryon-web` 项目。当前账号新建团队仅提供 Pro/Pro Trial，因此不创建新团队或启动试用；独立项目不意味着独立的团队免费配额。

为避免新增 OSS 按量费用，单机部署复用已有 FsStorage。媒体持久化在 `/var/lib/yoryon/media`，API 只读挂载，CLI 读写挂载。
CLI 必须在服务器容器内运行，使发布媒体与 API 读取同一目录。所有媒体仍需验权和短期签名，目录不直接暴露为静态文件站点。

## 取舍与限制

- 服务器只有 1 GB RAM，镜像在工作站构建；API 384 MB、Caddy 128 MB。图片、小型音视频可先使用此部署。
- 当前 FsStorage 每次完整读入媒体再处理 Range，不适合大视频或高并发。上线大文件前必须实现流式读取并做内存/并发验收，或明确批准对象存储的费用与迁移。
- 媒体与备份均依赖服务器磁盘；本机备份不能防止整机丢失，应定期下载到独立设备。监测磁盘，预留空间，不能宣称等同托管对象存储的持久性。
- Neon Free 的额度、休眠和恢复窗口由供应商控制；达到上限可能暂停服务。本配置不自动升级计划。
- 注册/找回密码依赖真实 SMTP。SMTP 未验证前不得把这些路径报告为上线通过。
- DirectMail 已以 `notify.yoryon.com` 独立发信子域名部署，2048 位 DKIM，保留根域名企业邮箱。真实 Gmail 注册/重置验收与生产阅读/鉴权验收分开记录，SMTP 接受不代表进入收件箱。
- 公开文章静态化、发布预热、下线/转付费清缓存属于 GitHub Issue #6，当前部署不代表该需求已实现。
- 生产 BFF 验收发现媒体公开 302 被 Vercel 缓存 300 秒：原站已拒绝或删除媒体时，边缘仍返回旧签名跳转。发布失效机制完成前，Caddy 对 `/api/media/*` 覆盖 `Cache-Control: private, no-store`，首次启用清空该项目 CDN 缓存；代价是每次获取媒体跳转都回源验权。Issue #6 完成硬失效及真实 CDN 验收后才评估恢复缓存。已经取得的媒体文件无法收回，已签发的 URL 仍遵守原有 900 秒有效期。

## 发布与恢复

使用 `deploy/compose.neon.yml`。密钥保存在服务器 `/etc/yoryon`，权限 0700/0600，禁止提交和记录连接串。
运行 `migrate` 成功后再启动 API/Caddy。镜像以 Git SHA 与构建编号标记，保留前一版本镜像以便回滚应用；数据库迁移单独评估，不能直接用旧镜像回滚破坏性迁移。
验收使用隔离 E2E 数据库和合成数据。生产冒烟检查只使用明确标记的临时数据，验证后清理，不将密码、令牌、验证码或完整签名 URL 写进工件。
