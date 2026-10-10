# 个人多媒体博客平台 — 架构设计

状态：v1 设计基线（已经过两轮设计评审，修正已并入）

## 1. 产品边界

核心业务闭环：

```
发布内容 → 合集/标签组织 → 配置付费策略 → 生成激活码 → 第三方售卖 → 用户兑换 → 权益生效 → 解锁内容/媒体
```

- 平台不碰支付：收款在第三方平台完成，站内只做激活码兑换与权益校验。
- v1 不含：评论、点赞、关注、推荐、站内支付、自动续费、Web 管理后台（管理操作全部由 CLI 承担）。
- 内容类型：文章（Markdown，可嵌入图片/视频/音频）、图片、视频、音频，四类均有独立 URL。
- 付费预览策略（按内容独立配置）：全文公开 / 百分比预览 / 自定义截断标记 / 完全付费。

## 2. 总体架构

```
[浏览器]
   │  仅同源访问 www.example.com（含 /api/* 代理）
   ▼
[Vercel] Next.js 前端（SSR；不含业务密钥）
   │  Route Handler 代理 /api/*：读取 HttpOnly Cookie → 转 Authorization: Bearer
   │  （RSC 服务端渲染时由统一 apiFetch helper 显式转发凭证）
   ▼
[阿里云 ECS · Docker Compose]
   ├─ api       Node.js + Hono：鉴权、权益、兑换、媒体签名 URL（只认 Bearer）
   ├─ postgres  PostgreSQL 16（仅 docker 内网，5432 不出网）
   └─ caddy     反向代理 + 自动 TLS（api.example.com）
        │
        ├─► 阿里云 OSS：public 桶（CDN 直链）/ private 桶（签名 URL）
        └─► 邮件：阿里云 DirectMail SMTP（注册/重置验证码；开发用 Mailpit）

[本地 CLI] ──SSH 隧道──► PostgreSQL；──最小权限 RAM──► OSS
```

关键边界：

- **所有管理操作不经 Web API**。v1 的 API 仅暴露用户侧端点，攻击面最小。
- **权限校验全部在服务端**。付费正文不进入未授权响应（不是前端隐藏）。
- 三种付费形态（单篇/合集/订阅）共用一套 Entitlement 模型与 `canAccess` 校验，见 ADR-0002。

## 3. 技术选型

| 模块 | 选型 | 说明 |
|---|---|---|
| 前端 | Next.js 15（App Router）+ Tailwind | 付费页面必须 SSR，响应中只含裁剪后内容 |
| 后端 | Hono（Node runtime） | 轻量，路由即 API |
| ORM / 迁移 | Drizzle + drizzle-kit | schema 即文档，迁移可追踪 |
| 数据库 | PostgreSQL 16 | 事务保证兑换幂等 |
| 密码 | argon2id | — |
| 会话 | DB Session + HttpOnly Cookie（host-only） | 可撤销，30 天滑动过期 |
| OSS | ali-oss SDK | 双桶隔离 |
| 邮件 | nodemailer（SMTP） | 生产接 DirectMail SMTP，开发用 Mailpit，一套代码 |
| Markdown | unified / remark AST | 预览截断基于渲染后块结构 |
| 测试 | Playwright E2E | 唯一测试机制，走真实用户路径 |

## 4. Monorepo 结构（pnpm workspaces）

```
yoryon/
├─ apps/
│  ├─ web/        # Next.js 前端 → Vercel
│  ├─ api/        # Hono 后端 → 阿里云 Docker
│  └─ cli/        # 命令行：发布/合集/激活码/权益/用户管理 → 本地运行
├─ packages/
│  ├─ db/         # Drizzle schema + 迁移 + 客户端
│  ├─ core/       # 领域逻辑：canAccess、预览截断、激活码、邮件（api 与 cli 共用）
│  └─ config/     # 环境变量校验（zod）、共享类型与常量
├─ deploy/        # docker-compose.yml、Caddyfile、备份脚本
├─ e2e/           # Playwright 端到端测试
└─ docs/          # 本文档 + adr/
```

**预览截断与权益校验只在 `packages/core` 实现一次**，API 与 CLI 复用，杜绝逻辑漂移。

## 5. 数据模型

```sql
users(
  id uuid pk, email citext unique not null, username text unique not null,
  password_hash text not null,
  role text not null default 'user' check (role in ('admin','user')),
  status text not null default 'pending' check (status in ('pending','active','disabled')),
  created_at timestamptz, updated_at timestamptz
)

email_verifications(
  id uuid pk, email citext not null,
  purpose text not null check (purpose in ('register','password_reset')),
  code_hash text not null,            -- 验证码只存哈希
  expires_at timestamptz not null, attempts int not null default 0,
  consumed_at timestamptz, created_at timestamptz
)

sessions(
  id uuid pk, token_hash text unique not null,   -- Cookie 中只放原始 token，库中存哈希
  user_id uuid not null references users,
  expires_at timestamptz not null, last_used_at timestamptz,
  ip inet, user_agent text, created_at timestamptz
)

contents(
  id uuid pk, type text not null check (type in ('article','image','video','audio')),
  slug text unique not null, title text not null, description text not null default '',
  body_markdown text not null default '',
  visibility text not null default 'public' check (visibility in ('public','paid')),
  preview_mode text not null default 'full' check (preview_mode in ('full','percent','marker','none')),
  preview_percent int check (preview_percent between 1 and 99),
  cover_media_id uuid references media_assets,
  published_at timestamptz, created_at timestamptz, updated_at timestamptz
)
create index on contents (published_at desc);

media_assets(
  id uuid pk,                             -- 不可枚举 UUID
  bucket text not null check (bucket in ('public','private')),
  oss_key text not null, mime_type text not null, size_bytes bigint,
  duration_sec int, width int, height int, created_at timestamptz,
  unique (bucket, oss_key)
)

-- 媒体与内容的关联 + 预览曝光合同（ADR-0004）
content_media(
  content_id uuid not null references contents on delete cascade,
  media_id uuid not null references media_assets,
  position int not null,                  -- 在正文中的块顺序
  exposure text not null check (exposure in ('free','paid')),  -- 发布期由截断函数计算
  primary key (content_id, media_id)
)

collections(
  id uuid pk, slug text unique not null, title text not null,
  description text not null default '',
  visibility text not null default 'public' check (visibility in ('public','paid')),
  cover_media_id uuid references media_assets,
  created_at timestamptz, updated_at timestamptz
)

collection_items(
  collection_id uuid not null references collections on delete cascade,
  content_id uuid not null references contents on delete cascade,
  sort_order int not null,
  primary key (collection_id, content_id)
)

tags(id uuid pk, slug text unique not null, name text not null)
content_tags(content_id uuid references contents on delete cascade,
             tag_id uuid references tags on delete cascade,
             primary key (content_id, tag_id))

activation_codes(
  id uuid pk, code text unique not null, batch_id uuid not null,
  grant_type text not null check (grant_type in ('content','collection','subscription')),
  grant_content_id uuid references contents,
  grant_collection_id uuid references collections,
  subscription_days int,                  -- grant_type=subscription 时必填
  max_uses int not null default 1, used_count int not null default 0,
  expires_at timestamptz,                 -- 码本身的有效期（非权益有效期）
  status text not null default 'active' check (status in ('active','disabled')),
  note text not null default '', created_at timestamptz
)

redemptions(
  id uuid pk, code_id uuid not null references activation_codes,
  user_id uuid not null references users,
  created_at timestamptz, revoked_at timestamptz,
  unique (code_id, user_id)               -- 幂等兜底（ADR-0002）
)

entitlements(
  id uuid pk, user_id uuid not null references users,
  scope_type text not null check (scope_type in ('content','collection','subscription')),
  scope_id uuid,                          -- content/collection 的 id；subscription 恒为 null（覆盖全部付费内容）
  valid_from timestamptz not null default now(),
  valid_until timestamptz,                -- null = 长期有效
  redemption_id uuid unique not null references redemptions,  -- 1:1，append-only
  revoked_at timestamptz, created_at timestamptz
)
create index on entitlements (user_id, scope_type, scope_id);
```

语义约定：

- **订阅** = `scope_type='subscription'` 且 `scope_id IS NULL`，覆盖全部付费内容（v1 无范围配置）。
- **合集授权动态解析**：校验时查合集当前成员，合集新增内容自动被既有授权覆盖（不做快照）。
- **权益 append-only**：每次兑换各自插入一条 Entitlement；用户有效订阅期 = 未撤销订阅权益的 `MAX(valid_until)`，重复兑换自然叠加延长。撤销粒度为单次兑换（revoke redemption → 级联语义上 revoke 其 entitlement）。

## 6. 核心领域逻辑（packages/core）

### 6.1 统一权益校验

```ts
canAccess(user, content, now):
  if content.visibility == 'public' → true
  if user?.role == 'admin' → true
  if !user → false
  存在 entitlement e：
    e.user_id = user.id AND e.revoked_at IS NULL
    AND e.valid_from <= now AND (e.valid_until IS NULL OR e.valid_until > now)
    AND ( (e.scope_type='content'  AND e.scope_id = content.id)
       OR (e.scope_type='collection' AND content ∈ collection_items(e.scope_id))   -- 动态成员
       OR (e.scope_type='subscription') )
  → true；否则 false
```

### 6.2 预览截断（Markdown AST 层）

输入 `body_markdown + preview_mode + preview_percent`，输出
`{ freeAst, paidAst, freeMediaIds }`。同一函数服务两条路径：阅读时裁剪正文、发布时计算媒体曝光。

- `full`：全部免费；`none`：正文全付费（仅标题/描述可见）。
- `marker`：正文中的 `<!-- more -->` 注释为分界，之前免费。
- `percent`：按顶层块权重累计。文本块按字符数计权；媒体块（图片/视频/音频）为**原子单位**，按固定等价字符数计权（默认 300，可配置），要么整块在免费区、要么整块在付费区，绝不截断一半。
- 截断在 AST 层进行，绝不直接切割 Markdown 源码。

### 6.3 媒体访问控制（ADR-0004）

- public 桶媒体：不进 API，直接 CDN 地址。
- private 桶媒体经 `GET /api/media/:id`，满足任一条件签发短期签名 URL（TTL 15 分钟）并 302：
  1. 该媒体在**任一已发布内容**中 `exposure='free'` → 匿名可访问（预览区媒体必须能加载）；
  2. 当前用户对**任一引用该媒体的内容**通过 `canAccess` → 放行；
  3. 否则 403。
- 同一媒体被多个内容引用时 `free` 优先（它事实上已公开）。
- 封面图恒进 public 桶（出现在公开信息流）。
- 独立付费图片/视频/音频内容：标题与描述免费，媒体本体恒为 paid，不参与百分比预览（v1 语义）。

### 6.4 激活码兑换（幂等 + 防超发，ADR-0002）

```
BEGIN;
SELECT * FROM activation_codes WHERE code = ? FOR UPDATE;   -- 序列化同一码的并发
码不存在 / 已停用 / 已过期 → ROLLBACK，返回对应错误
SELECT * FROM redemptions WHERE code_id = ? AND user_id = ?;
  → 已存在：COMMIT，返回已有权益（幂等成功，不动计数）
UPDATE activation_codes SET used_count = used_count + 1
  WHERE id = ? AND used_count < max_uses;
  → 0 行：ROLLBACK，返回"已兑完"
INSERT redemptions; INSERT entitlements（订阅 valid_until = now + subscription_days）;
COMMIT;
-- 唯一约束 (code_id, user_id) 兜底：捕获 23505 → 重新查询，按幂等成功返回
```

## 7. API 契约（v1，仅用户侧；全部经 www 同源代理）

```
POST /api/auth/register            { email, username, password } → 创建 pending 用户并发验证码
POST /api/auth/verify-email        { email, code }               → 激活账号
POST /api/auth/resend-code         { email, purpose }            → 重发（60s 冷却）
POST /api/auth/login               { emailOrUsername, password } → Set-Cookie（host-only）
POST /api/auth/logout
POST /api/auth/password-reset      { email } → 发码；{ email, code, newPassword } → 重置
GET  /api/auth/me

GET  /api/feed?cursor=             首屏信息流（内容+合集混排，游标分页；不读 session，公开缓存）
GET  /api/contents/:slug           内容详情（按权益返回 full | preview；no-store）
GET  /api/collections/:slug        合集页（成员按权益裁剪正文；no-store）
GET  /api/tags/:slug?cursor=       标签筛选（公开缓存）
GET  /api/media/:id                私有媒体验权 → 302 签名 URL（no-store）

POST /api/redemptions              { code } → 兑换（幂等）
GET  /api/me/entitlements          我的权益列表（含来源与有效期）
```

约定：

- 错误格式统一 `{ error: { code, message } }`；幂等成功返回 200 + 已有权益。
- 限流：login / register / verify / redeem 按 IP + 账户双维度令牌桶（单实例内存实现）；`X-Forwarded-For` 由 web 代理层传递。
- 管理操作无 API 端点，全部走 CLI。

## 8. 前端页面

| 路由 | 说明 |
|---|---|
| `/` | 首屏信息流：最新内容卡片 + 合集卡片推特式混排；对所有人一致（不含"已解锁"角标），可公开缓存 |
| `/p/[slug]` | 内容详情（文章/图集/视频/音频）；付费内容按权益渲染全文或预览 + 解锁引导 |
| `/c/[slug]` | 合集页：合集信息 + 成员内容流（支持排序） |
| `/tags/[slug]` | 标签筛选结果 |
| `/login` `/register` | 认证页（注册含邮箱验证码步骤） |
| `/redeem` | 激活码兑换框 + 已获得权益列表（极简，非个人中心） |

要求：响应式（移动端/桌面一体）；简洁清爽；文章不强制封面；加载/空态/错误/重试态齐备。

## 9. 认证、会话与邮件（ADR-0001）

- **Cookie**：host-only `www.example.com`（不带 Domain），HttpOnly + Secure + SameSite=Lax，30 天滑动过期；库中只存 token 哈希。
- **代理层**（web Route Handler `/api/*`）：路径白名单、剥除非必要头、Cookie→`Authorization: Bearer`、附 `X-Forwarded-For`、透传 302 Location。api 只认 Bearer，不接受浏览器 Cookie，CORS 配置整体消失。
- **SSR**：唯一入口 `apiFetch` helper——读 Cookie 拼 Bearer、强制 `cache: 'no-store'`。
- **CSRF**：Bearer 方案天然免疫（浏览器不自动附加）；代理层再做 Origin 白名单校验（仅 `https://www.example.com`）作为纵深防御；无可变更状态的 GET。
- **邮件**：注册验证码 / 密码重置码，6 位数字、10 分钟有效、库存哈希、单码 5 次尝试上限、60 秒重发冷却。生产走 DirectMail SMTP，开发/测试走 Mailpit。

## 10. 缓存策略（ADR-0003）

| 响应 | 策略 |
|---|---|
| `/api/feed`、`/api/tags/:slug`、合集元信息（对所有人一致） | `Cache-Control: public, max-age=60, stale-while-revalidate`；端点实现中**不允许读 session** |
| 内容详情、`/api/me/*`、兑换 | 页面 `force-dynamic` + fetch `no-store`；响应 `Cache-Control: private, no-store` |
| `/api/media/:id` 的 302 | `private, no-store`（被共享缓存 = 签名 URL 泄露） |

硬性规则：任何渲染权益相关内容的页面禁止 ISR/revalidate；任何读取 session 的端点必须 no-store。由 E2E 验证（§13）。

## 11. CLI 管理工具（apps/cli）

```
blog publish <dir|file>          # 发布/更新内容：解析 frontmatter → 上传本地媒体到 OSS
                                 # （按 visibility 选桶）→ 改写引用 → 重算曝光 → upsert DB
blog unpublish <slug>
blog collection create|add|remove|sort ...
blog tag list
blog code create --grant-type ... [--content slug | --collection slug | --days N]
                 --count N [--max-uses N] [--expires DATE] [--note ...]   # 批量生成
blog code list|disable
blog redemption list|revoke      # 撤销单次兑换（级联撤销对应权益）
blog entitlement list
blog user list|disable|promote
blog db tunnel                   # 建立到生产库的 SSH 隧道（用完自动断开）
```

发布目录约定（frontmatter 驱动，对应"本地文档直接上传"场景）：

```
posts/my-article/
├─ index.md        # 含 frontmatter
└─ media/          # 正文中以相对路径引用，发布时上传并改写
---
title: 标题
slug: my-article
type: article
visibility: paid
preview: { mode: percent, percent: 30 }   # full | percent | marker | none
tags: [tag-a, tag-b]
collections: [collection-slug]
published_at: 2025-01-01
---
```

## 12. 部署与运维

- **域名**：`www.example.com` → Vercel；`api.example.com` → ECS（Caddy 自动 TLS）。需自有域名；ECS 在境内需备案。Vercel 境内访问不稳定，若读者主要在境内，web 层可整体平移阿里云（前后端已解耦，代理层摘掉即可直连）。
- **docker-compose**：`api` + `postgres`（数据卷）+ `caddy`。Postgres 仅内网；迁移用独立 migrator 用户在部署期执行。
- **凭证分离**：api 运行时 DB 用户（无 DDL）/ migrator / CLI 管理用户三者分离；OSS 双 RAM 身份——api 仅 private 桶 GetObject/签名，CLI 发布身份才有双桶 Put/Delete；桶级管理权限不授予任何一方。所有密钥只存在于环境变量，不进仓库。
- **CLI 连接生产**：默认 SSH 隧道（`blog db tunnel`）；已使用 Tailscale 时可走私有网段直连。5432 永不暴露公网。
- **备份**：每日 cron `pg_dump | gzip` → OSS 私有备份桶（lifecycle 保留 30 天）。
- **日志**：api 结构化日志（请求 id、用户 id、耗时），不记录密码、验证码、激活码明文、签名 URL 参数。

## 13. E2E 验收策略（唯一测试机制）

环境：本地 `docker compose`（api + postgres + Mailpit + web dev server）+ seed 数据隔离；Playwright 走真实浏览器路径；产出 HTML 报告、截图、trace 作为验收工件（不含敏感信息）。

验收路径：

1. 注册 → Mailpit 收码 → 验证 → 登录 → 登出。
2. 匿名可读公开内容全文。
3. 付费文章：匿名/未授权仅见预览（分别验证 percent 与 marker 两种模式，断言付费块与付费媒体不出现在响应中）。
4. CLI 生成激活码 → 用户兑换 → 同内容全文可见；**重复兑换返回幂等成功且计数不增**；并发兑换不超发。
5. 合集授权 → 合集内成员解锁；CLI 向合集新增内容后，旧授权自动覆盖新内容。
6. 订阅兑换 → 全部付费内容解锁；过期（短时权益 seed）后回落预览态。
7. 私有媒体：预览区媒体匿名可加载；付费区媒体匿名 403；授权后 302 且签名 URL 可取字节；302 响应无共享缓存头。
8. 缓存隔离：授权用户访问详情页后，匿名请求同 URL 仍为预览版，并断言响应头。
9. 撤销兑换 → 用户回落预览态，媒体同步 403。
10. 密码重置全流程（邮件验证码）。

## 14. ADR 索引

| 编号 | 决策 |
|---|---|
| [ADR-0001](adr/0001-bff-proxy-auth.md) | BFF 代理 + Bearer 转换的身份传递方案 |
| [ADR-0002](adr/0002-append-only-entitlements.md) | 统一权益模型：append-only Entitlement 与兑换幂等 |
| [ADR-0003](adr/0003-cache-separation.md) | 缓存分线：付费内容不进共享缓存 |
| [ADR-0004](adr/0004-media-exposure-contract.md) | 媒体曝光合同：发布期计算 exposure 字段 |
