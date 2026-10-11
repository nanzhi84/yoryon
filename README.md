# Yoryon Blog

个人多媒体博客（文章 / 图片 / 视频 / 音频），支持付费阅读（单篇 / 合集 / 订阅）与本地 CLI 管理。

Monorepo（pnpm workspaces）：

| 路径 | 说明 |
| --- | --- |
| `apps/web` | Next.js 15（App Router）前端 + 同源 BFF 代理（Route Handler） |
| `apps/api` | Hono API（认证 / 内容 / 媒体 / 兑换），唯一授权决策点 |
| `apps/cli` | 本地管理 CLI（发布、合集、标签、激活码、权益、用户、GC、SSH 隧道） |
| `packages/core` | 领域逻辑：预览截断、权益判定、兑换事务、媒体访问、发布两阶段、GC |
| `packages/db` | Drizzle schema + 迁移 |
| `packages/config` | zod 环境变量校验（启动即失败） |
| `deploy/` | 生产 docker-compose（postgres + migrate + api + caddy）、备份/恢复脚本 |
| `e2e/` | Playwright 端到端测试（唯一自动化测试机制） |

架构与关键决策见 `docs/architecture.md` 与 `docs/adr/0001~0006`。

## 本地从零运行

前置：Node ≥ 20、pnpm ≥ 9、Docker（本地 Postgres 与 Mailpit）。

```bash
pnpm install
cp .env.example .env          # 开发默认值即可用
pnpm docker:dev               # 启动 postgres(54320) + mailpit(11025/18025)
pnpm db:migrate               # 执行迁移（env-file=.env）
pnpm dev                      # 同时启动 api(4100) 与 web(3000)
```

打开 http://localhost:3000 。注册后验证码邮件在 Mailpit：http://localhost:18025 。

常用命令：

```bash
pnpm build          # 全部构建（api/cli 走 tsup，web 走 next build）
pnpm typecheck      # 全部类型检查
pnpm db:generate    # 改 schema 后生成迁移
pnpm db:migrate     # 执行迁移
pnpm e2e            # 端到端测试（见下）
```

## CLI（本地管理，经 SSH 隧道连生产库）

```bash
pnpm --filter @yoryon/cli build        # 产物 apps/cli/dist/index.js
node apps/cli/dist/index.js --help
```

内容包约定：`index.md`（frontmatter + 正文）+ `media/`（相对引用 `./media/x.png`）。正文媒体语法：图片 `![alt](./media/x.png)`；视频/音频 `::video{src="./media/x.mp4"}` / `::audio{src="./media/x.mp3"}`；付费预览标记 `<!-- more -->`（`preview.mode=marker` 时必需，缺失拒绝发布）。付费文章省略 preview 配置时默认 `none`（正文全付费）；需要全篇免费预览必须显式声明 `preview.mode: full`。

```bash
# 发布 / 更新 / 取消发布（幂等，可安全重跑）
blog publish ./posts/my-article      # 目录（含 index.md）、index.md 路径，或多篇内容的父目录
blog unpublish my-article
blog content list [--all]            # 默认只列已发布
blog content delete my-article

# 合集与标签
# 合集成员的唯一事实源是文章 frontmatter 的 collections: [slug]，随发布生效；
# CLI 仅管理合集元数据与排序（不提供成员增删命令，避免与发布互相覆盖）。
blog collection create <slug> --title "Go 合集" [--visibility paid]
blog collection list
blog collection sort <slug> <content-slug...>   # 未列出的成员排到末尾
blog tag list                        # 标签由发布时 frontmatter tags 自动创建，无需手动 add

# 激活码与权益
blog code create --grant-type content --content my-article --count 10 [--max-uses 1]
blog code create --grant-type subscription --days 30 --count 100
blog code create --grant-type collection --collection golang --count 5
blog code list [--batch <id>]
blog code disable <code>              # 参数为码值本身
blog redemption list [--code <code>]
blog entitlement list [--user <email|username>]
blog entitlement revoke <entitlement-id> --reason "退款" [--by <email|username>]
blog entitlement grant --user <email|username> --scope content:<slug> [--days 30]

# 用户
blog user list
blog user disable <email|username>   # 禁用并即时删除会话
blog user promote <email|username>   # 提升为 admin（绕过付费墙）

# 媒体 GC（默认 dry-run；与发布经 PG Advisory Lock 互斥）
blog media gc
blog media gc --apply

# 生产访问：先开隧道（本地 127.0.0.1:55432 → 宿主机回环 5432 → compose postgres）
blog db tunnel
DATABASE_URL=postgres://yoryon:***@localhost:55432/yoryon node apps/cli/dist/index.js publish ./posts/x
```

## 生产部署（单 ECS + 阿里云 OSS + DirectMail）

见 `deploy/`：

```bash
cd deploy
cp ../.env.example .env   # 填生产值：POSTGRES_PASSWORD、API_DOMAIN、STORAGE_BACKEND=oss、OSS_*、MAIL_*、BFF_SHARED_SECRET、SITE_URL、ALLOWED_ORIGINS
docker compose up -d      # postgres + migrate（建表，失败则 api 不上线）+ api + caddy(80/443, 自动 TLS)
./backup.sh               # 每日 pg_dump（建议 crontab）
./restore.sh <dump.sql.gz>
```

网络拓扑：Caddy 是唯一公网入口，监听 `API_DOMAIN`（80/443，自动 TLS）并反代到 compose 内网的 `api:4000`（覆写 `X-Forwarded-For`）；postgres 只暴露宿主机回环 `127.0.0.1:5432`（供 `blog db tunnel` 使用），API 端口不发布到宿主机。

前端 `apps/web` 部署到 Vercel，环境变量：`API_INTERNAL_URL=https://<API_DOMAIN>`、`BFF_SHARED_SECRET`（与 API 相同）、`ALLOWED_ORIGINS=https://<域名>`、`SITE_URL`。Vercel 无法直连 ECS 内网，BFF 统一经 Caddy 公网入口回源；终端用户 IP 由 BFF 共享密钥 + `X-Client-IP` 传递（ADR-0001 §9.5），不依赖内网直达。也可把 web 一并跑在 compose 里（自行加服务，此时 `API_INTERNAL_URL=http://api:4000`），Caddyfile 按域名拆分调整。

## 端到端测试（唯一自动化测试机制）

```bash
pnpm e2e          # 或 cd e2e && pnpm exec playwright test
```

- 基建：`e2e/docker-compose.e2e.yml`（postgres 54329 + mailpit 11125/11126 + caddy 4199 模拟 CDN/边缘回源）。
- 每次运行：`global-setup.ts` 重建库（drop schema + migrate）、清空存储目录、用 ffmpeg 生成真实媒体 fixture、写 run-id。
- 存储用文件系统模拟私有桶（`STORAGE_BACKEND=fs`），签名 URL 语义与 OSS 一致（HMAC + expires + 302 + Range）。
- 可控同步点：`BLOG_PUBLISH_TEST_HOOK=signal-after-upload` + `BLOG_TEST_SIGNAL_DIR` 让发布进程在“已上传未入库”处停住，验证 GC/发布互斥与失败恢复。
- 50 个用例覆盖全部 16 项验收与 PR 评审安全回归（`e2e/tests/`，用例头注释标注对应验收编号）。工件：`.data/`（api/web 日志、存储、posts）、`test-results/`（失败时 trace/截图）。

## 关键不变量（实现与测试共同锁定）

1. 付费正文与付费媒体 URL 绝不出现在未授权响应（API 层两路验证）。
2. 媒体免费/付费判定取“该媒体可访问内容的免费最大份额”；内容按付费份额排序比较；曾免费的媒体转付费后 `/api/media/:id` 立即 403、停止签发新 URL（已签发 URL 在 TTL 内仍可取字节，见 architecture §6.3 撤销时效边界）。
3. 兑换在单事务内：用户行锁 → 码行锁 → 幂等查重 → 条件 UPDATE 防超发 → 插入 redemption + entitlement；并发不超发、重复兑换幂等。
4. 订阅接续：`valid_from = max(now, 未撤销订阅的最大 valid_until)`；撤销后回落预览态。
5. 发布两阶段（先传对象后单事务入库），任意中断可安全重跑；与 GC 经 Advisory Lock 互斥；GC 宽限期（孤儿 24h / 零引用 7d）。
6. 缓存隔离：公开线 `s-maxage`/`public`，私有线一律 `private, no-store`；BFF 写操作 CSRF 检查；API 仅信任带 BFF Token 的 `X-Client-IP`。
