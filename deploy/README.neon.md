# 免费计划生产部署

设计与限制见 [ADR-0008](../docs/adr/0008-free-plan-production.md)。新服务不自动升级；已有服务器和域名仍需续费。

## 环境

- Aliyun：`admin@8.222.152.17`，实例 `30b9175a0c2e4508ba50c7b50c2994d3`，Ubuntu 24.04，x86_64。
- Neon：`Yoryon Personal` / `yoryon-production`，Free，AWS 新加坡，Postgres 16。
- Cloudflare：`yoryon.com` Free，`api.yoryon.com` 为 DNS-only A 记录；Caddy 负责 TLS。
- Vercel：`yoryon-web` 当前在已有 Hobby Team。新建 Team 界面只有 Pro/Pro Trial，独立 Hobby Team 尚未完成。

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

SMTP 尚未配置时，服务器 Caddy 临时拒绝注册、重发验证码与重置密码，返回明确的 503 `mail_not_configured`，不创建无法激活的账号。
配置 SMTP 并验收后，用仓库中的 `Caddyfile.production` 覆盖临时配置、验证后 reload，恢复这些入口。

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
```

E2E 只使用 `e2e/helpers/env.ts` 中固定的本地 Docker PostgreSQL、Mailpit 和合成内容，不允许替换成生产数据库。
验收报告应区分本地完整流程、生产 API、生产浏览器以及真实邮件投递，不以 `/health` 代替业务通过。

服务器以 root 执行 `deploy/backup-neon.sh`，生成数据库与媒体的校验和，保留 7 天。备份仍在同一台机器，应下载到独立设备。
恢复到隔离数据库后验证，再考虑切换生产；不要直接覆盖运行数据库。应用回滚：将 `.env` 的镜像标签改回上一版，重新 `up -d --wait`，迁移兼容性另行检查。
