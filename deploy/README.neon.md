# 免费计划生产部署

设计与限制见 [ADR-0008](../docs/adr/0008-free-plan-production.md)。Neon、Cloudflare 与 Vercel 保留免费计划；已有服务器、域名仍需续费。用户另行批准 DirectMail 超过免费额度后按量计费。

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

当前版本不是公开文章静态化版本；Issue #6 另行实施。FS 模式尚未做大文件流式读取，不应在这台 1 GB 实例上发布大视频。

## 验收与备份

```sh
pnpm typecheck
pnpm e2e
node deploy/verify-production.mjs https://yoryon.com --browser --smtp-ready
node deploy/verify-production-mail.mjs --email <明确授权的无网站账号 Gmail 地址>
```

E2E 只使用 `e2e/helpers/env.ts` 中固定的本地 Docker PostgreSQL、Mailpit 和合成内容，不允许替换成生产数据库。
验收报告应区分本地完整流程、生产 API、生产浏览器以及真实邮件投递，不以 `/health` 代替业务通过。

生产脚本与本地 E2E 分开：需要本机 `~/.config/yoryon-production/secrets.json` 中的生产 CLI 连接、该实例 SSH 权限，以及已安装的 E2E Chromium。`verify-production.mjs` 通过服务器 CLI 发布唯一前缀的合成内容，建立 active 测试账号，走页面登录、兑换、阅读、撤权和下线，最后仅清理自身数据；不会发邮件，也不会将夹具账号建立当作注册验收。运行期间临时内容可在公开站点出现。`--smtp-ready` 工件写入 `artifacts/production-mail-ready-20261012/`，此前 SMTP 关闭阶段的 `artifacts/production-20261012/` 保留历史记录。

`verify-production-mail.mjs` 仅向明确授权且没有现有网站账号的邮箱发送注册和重置两封邮件。脚本输出 `AWAIT_MAIL` 后，操作者通过 Gmail 连接器验证真实邮件的 headers/labels，将 `{run,purpose,sender,messageId,labelIds,authentication:{spf,dkim,dmarc},source:"gmail_connector"}` 写入受保护配置目录的 `<purpose>.receipt.json`（0600）。Gmail 隐藏一次性验证码，由人从真实邮件取码并填写同目录 `mail-acceptance-codes.json` 的 `register` / `password_reset` 字段；保留脚本生成的 run 标识。每阶段有界等待 8 分钟，不读取数据库中的验证码。工件写入 `artifacts/directmail-20261012/attempts/<run>/`，仅含脱敏截图、消息 ID 哈希、断言和清理状态；结束擦除取码文件中的值。最新报告另存 `real-mail-acceptance.json`。临时账号按邮箱、唯一用户名与创建时间核对后删除，不修改已有账号。不保存密码、验证码、Cookie、SMTP 凭据或邮件正文。

服务器以 root 执行 `deploy/backup-neon.sh`，生成数据库与媒体的校验和，保留 7 天。备份仍在同一台机器，应下载到独立设备。
恢复到隔离数据库后验证，再考虑切换生产；不要直接覆盖运行数据库。应用回滚：将 `.env` 的镜像标签改回上一版，重新 `up -d --wait`，迁移兼容性另行检查。
