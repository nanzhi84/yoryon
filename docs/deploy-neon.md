# 免费计划生产部署

设计与限制见 [ADR-0008](adr/0008-free-plan-production.md)。Neon、Cloudflare 与 Vercel 保留免费计划；已有服务器、域名仍需续费。用户另行批准 DirectMail 超过免费额度后按量计费。

## 环境

- Aliyun：`admin@8.222.152.17`，实例 `30b9175a0c2e4508ba50c7b50c2994d3`，Ubuntu 24.04，x86_64。
- Neon：`Yoryon Personal` / `yoryon-production`，Free，AWS 新加坡，Postgres 16。
- Cloudflare：`yoryon.com` Free，`api.yoryon.com` 为 DNS-only A 记录；Caddy 负责 TLS。
- Vercel：用户确认沿用已有 Hobby Team 下的独立 `yoryon-web` 项目，不创建 Trial 或付费团队。
- DirectMail：杭州 `smtpdm.aliyun.com:465`，发件人 `Yoryon <noreply@notify.yoryon.com>`，独立 2048 位 DKIM 发信子域名。

生产目录 `/opt/yoryon`。密钥文件 `/etc/yoryon/{api,cli,migrate}.env`，仅 root 可读。
API 使用 Neon 池化地址与 `yoryon_api`；CLI 使用直连地址与 `yoryon_cli`；迁移使用直连 owner。
三个文件不在仓库；API/CLI 必需的其他字段见 `packages/config/src/env.ts`。SMTP 必須是真实已验证的发信服务。

## 构建与发布

```sh
docker build --platform linux/amd64 -f deploy/Dockerfile.production -t yoryon-api:<release> .
docker save yoryon-api:<release> | gzip -1 | ssh admin@8.222.152.17 'gzip -d | sudo docker load'
scp deploy/compose.neon.yml deploy/Caddyfile.production admin@8.222.152.17:/opt/yoryon/
```

服务器：

```sh
cd /opt/yoryon
# .env 只写 YORYON_IMAGE=yoryon-api:<release>，没有密钥
sudo docker compose -f compose.neon.yml run --rm migrate
sudo docker compose -f compose.neon.yml up -d --wait api caddy
```

迁移增加新表时，明确给 API/CLI 赋予所需权限；运行角色没有默认 DDL 权限，也不会自动获得新表权限。
前端生产环境设置 `API_INTERNAL_URL=https://api.yoryon.com`、与 API 相同的 `BFF_SHARED_SECRET`、`SITE_URL=https://yoryon.com`、两个域名的 `ALLOWED_ORIGINS` 后重新部署。
只配置 Production；预览部署不要默认连接生产数据库/管理凭据。

Caddy 对 `/api/media/*` 设置 `private, no-store`，防止公开转付费后 CDN 继续返回旧鉴权跳转。首次上线该策略须在已链接的 `yoryon-web` 工作目录执行 `vercel cache purge --type cdn --yes --scope zyy2740738166-7111s-projects`。正文静态化与自动缓存撤销仍由 Issue #6 跟进。

前端已获授权沿用现有 Hobby Team `zyy2740738166-7111s-projects`，保留独立项目 `yoryon-web`（`prj_xqDwJzlRrfdQA63FIMeIsRpReaRP`）。不创建 Trial 或付费团队。项目的配置、域名与部署独立，但 Hobby 配额仍按供应商的团队规则计算，不代表新增免费额度。

SMTP 已配置到 API/CLI 的受保护环境文件，真实注册/密码重置验收 32/32 通过，两封邮件均进入授权 Gmail 收件箱，SPF/DKIM/DMARC 通过。注册、重发和重置入口已开放；未使用的 DirectMail `mail.yoryon.com` 条目经用户授权删除，原企业邮箱 DNS 保留。

重新配置 SMTP：本机 `~/.config/yoryon-production/smtp-credentials.json` 必须为 0600，包含 `host`、`port`、`user`、`password`。运行 `python3 deploy/configure-production-smtp.py`，先验证真实 SMTP 登录，再安装配置并重建 API，失败自动恢复环境文件。不要把密码放入命令行或仓库。该脚本不修改 Caddy：邮件入口策略需要单独验证。当前邮件 gate 备份在 `/opt/yoryon/Caddyfile.smtp-pending-backup`；需要关闭入口时将它内容写回现有 Caddyfile（保留容器绑定的 inode），再 validate/reload；媒体 `private, no-store` 必须保持。

## 发布文章

将文章目录上传到 `/opt/yoryon/posts/<slug>`，包含 `index.md` 和 `media/`。

```sh
cd /opt/yoryon
sudo docker compose -f compose.neon.yml run --rm cli publish /posts/<slug>
sudo docker compose -f compose.neon.yml run --rm cli content list
```

当前版本不是公开文章静态化版本；Issue #6 另行实施。生产媒体已切换为新加坡私有 OSS；本地开发与隔离验收继续使用 FS。

## 验收与备份

```sh
pnpm typecheck
```

由主 agent 开独立子 agent，按根目录 `AGENTS.md` 现场验收。报告应区分本地完整流程、生产 API、生产浏览器以及真实邮件投递，不以 `/health` 代替业务通过；真实邮件只发送给明确授权的收件人。固定验证脚本已移除，历史验收工件仅为当时证据。



服务器以 root 执行 `/opt/yoryon/backup-neon.sh`，生成数据库与媒体的校验和，保留 7 天。OSS 模式由 `/opt/yoryon/backup-oss.py` 流式下载 `media/`，逐对象核对内容寻址 SHA256 与尺寸，归档中包含对象 manifest；本地 FS 模式仍备份文件目录。备份仍在同一台机器，应下载到独立设备。
恢复到隔离数据库后验证，再考虑切换生产；不要直接覆盖运行数据库。应用回滚：将 `.env` 的镜像标签改回上一版，重新 `up -d --wait`，迁移兼容性另行检查。

## 新加坡私有 OSS（2026-10-12）

桶 `yoryon-media-1089191161022541-sg`，`oss-ap-southeast-1`，Standard/LRS，private ACL，阻止公共访问，AES256 服务端加密。公网 HTTPS endpoint 用于浏览器短期签名 URL；不把 internal endpoint 配到 API 签名器。新加坡区域及 endpoint 见 [阿里云文档](https://www.alibabacloud.com/help/en/oss/user-guide/regions-and-endpoints)。按量付费，没有购买资源包。

API RAM 身份 `yoryon-oss-api` 只允许 `media/*` GetObject；CLI `yoryon-oss-cli` 允许该前缀读取、上传、删除、分片操作，以及限定 `media/` 前缀的列举。两者没有桶管理权限。密钥只在本机受保护的 `~/.config/yoryon-production/oss-credentials.json`（0600）和服务器 `/etc/yoryon/{api,cli}.env`，不写入仓库。配置前数据库和 FS 媒体都为空，因此无需迁移；配置脚本遇到非空媒体时拒绝直接切换，须另行持发布/GC 锁做迁移。

初始化（已执行）：`python3 deploy/configure-production-oss.py`，然后 `node deploy/configure-production-oss.mjs`。前者使用本机受保护的 `~/.alibabacloud/credentials` 管理凭据创建专用身份，后者校验桶和权限后切换 API/CLI。当前生产配置的重复验证及验收命令：

```sh
node deploy/configure-production-oss.mjs --verify-only
```


配置切换失败会恢复 `/etc/yoryon/{api,cli}.pre-oss.env` 并重建 API。成功上线后若已经有 OSS 文章，不能直接恢复空 FS：必须先按数据库引用将媒体下载回 FS 并核对哈希，再恢复配置。保留原 FS 目录与预切换配置，不把它们当成当前媒体备份。
