# Yoryon Blog

个人多媒体博客（文章 / 图片 / 视频 / 音频），支持付费阅读与本地 CLI 管理。

商业规则：对外统一只售**标准订阅**（¥29.9/月，全站付费内容解锁，到期自动失效），唯一兑换入口为 `/redeem`。
单篇/合集权益不作为商品售卖，其模型与 CLI 能力保留（存量兼容与运营赠送）。

Monorepo（pnpm workspaces）：

| 路径 | 说明 |
| --- | --- |
| `apps/web` | Next.js 15（App Router）前端 + 同源 BFF 代理（Route Handler） |
| `apps/api` | Hono API（认证 / 内容 / 媒体 / 兑换），唯一授权决策点 |
| `apps/cli` | 本地管理 CLI（发布、合集、标签、激活码、权益、用户、GC、Analytics、SSH 隧道） |
| `packages/core` | 领域逻辑：预览截断、权益判定、兑换事务、媒体访问、发布两阶段、GC |
| `packages/db` | Drizzle schema + 迁移 |
| `packages/config` | zod 环境变量校验（启动即失败） |
| `deploy/` | 生产 docker-compose（postgres + migrate + api + caddy）、备份/恢复脚本 |

架构与关键决策见 `docs/architecture.md` 与 `docs/adr/0001~0006`。

内容写作与当前渲染约定见 [Markdown 写作与渲染规则](docs/markdown-rendering.md)。

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
```

## CLI（本地管理，经 SSH 隧道连生产库）

```bash
pnpm --filter @yoryon/cli build        # 产物 apps/cli/dist/index.js
node apps/cli/dist/index.js --help
```

内容包约定：`index.md`（frontmatter + 正文）+ `media/`（相对引用 `./media/x.png`）。`type` 支持 `article`（标题必填的长文）和 `post`（标题可空的帖子），均可按正文顺序组合多媒体。正文媒体语法：图片 `![alt](./media/x.png)`；视频/音频 `::video{src="./media/x.mp4"}` / `::audio{src="./media/x.mp3"}`；站内作品引用 `::work{id="作品 UUID"}`（目标必须已发布，最多 20 个，不可引用自身）；付费预览标记 `<!-- more -->`（`preview.mode=marker` 时必需，缺失拒绝发布）。付费文章省略 preview 配置时默认 `none`（正文全付费）；需要全篇免费预览必须显式声明 `preview.mode: full`。

首页展示由作品的 `show_in_home` 独立管理，与 `visibility`、`collections` 无隐式联动。首次发布未归属合集的作品默认展示，首次在已有合集内发布的作品默认隐藏；迁移按原首页规则保留既有免费作品展示、会员作品隐藏，包括既有免费合集章节。重新发布省略 `show_in_home` 时保留数据库设置；明确提供 `show_in_home: true` 或 `false` 时应用该值。也可以用 `blog content home/hide` 改设置（之后的源文件不要保留相反的显式值）。合集目录只收已发布作品，编辑旧作品刷新全部所属合集的更新时间，并保留加入顺序。

```bash
# 发布 / 更新 / 取消发布（幂等，可安全重跑）
blog publish ./posts/my-article      # 目录（含 index.md）、index.md 路径，或多篇内容的父目录
blog unpublish my-article
blog content list [--all]            # 默认只列已发布
blog content delete my-article
blog content home my-article         # 开启首页展示；会员正文仍需权益
blog content hide my-article         # 关闭首页展示，不影响合集与直达阅读

# 合集与标签
# 合集成员的唯一事实源是文章 frontmatter 的 collections: [slug]，随发布生效；
# CLI 仅管理合集元数据与排序（不提供成员增删命令，避免与发布互相覆盖）。
blog collection create <slug> --title "Go 合集" [--visibility paid]
blog collection list
blog collection cover <slug> ./cover.png      # 上传到现有媒体存储，切换公开介绍封面
blog collection clear-cover <slug>            # 清除关联；旧对象沿用引用计数与 GC
blog collection pin <slug>                    # 可同时置顶多个合集
blog collection unpin <slug>
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

# 内容表现统计（指标口径与保留策略见 docs/analytics.md）
blog analytics overview --days 7
blog analytics top --metric views --days 30        # impressions|clicks|views|reads|ctr
blog analytics top --metric ctr --min-impressions 20
blog analytics content <slug> --days 30
blog analytics collection <slug> --days 30
blog analytics prune --days 365                    # 清理过期原始事件

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

## 验收

每次变更由主 agent 开独立子 agent，按影响范围现场执行真实浏览器、CLI、API 与数据库路径，检查失败方式、权限边界和最终可见结果。详见 `AGENTS.md`。

不维护固定测试套件、断言脚本或合成 fixture/harness。`pnpm typecheck` 与 `pnpm build` 只提供静态与构建证据，不能替代业务验收。验收工件保存在 `artifacts/<运行名>/`，记录版本、环境、数据前提、实际命令、结果与未覆盖项；历史工件不是当前测试入口。

帖子/长文、公开预览投影、引用与迁移的设计见 [ADR-0014](docs/adr/0014-post-article-references.md)，正式迁移入口、数据核对和回滚见 [post-migration.md](docs/post-migration.md)。数据库迁移通过应用 migrator 完成派生预览回填，不能只执行 SQL 后启动新 API。
