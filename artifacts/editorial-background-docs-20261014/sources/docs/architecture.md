# 个人多媒体博客平台 — 架构设计

状态：v1 设计基线 · 修订版

修订历史：

- 初版：设计基线 + ADR-0001~0004（已经两轮设计评审）。
- 2026-10-11：前端技术栈定稿（ADR-0005）；修正五项架构问题——订阅叠加、CSRF 边界、append-only 措辞、媒体生命周期、IP 信任（ADR-0001/0002/0003 修订，ADR-0006 新增并部分取代 ADR-0004）。

## 1. 产品边界

核心业务闭环：

```
发布内容 → 合集/标签组织 → 配置付费策略 → 生成激活码 → 第三方售卖 → 用户兑换 → 权益生效 → 解锁内容/媒体
```

- 平台不碰支付：收款在第三方平台完成，站内只做激活码兑换与权益校验。
- v1 不含：关注、推荐、站内支付、自动续费、Web 管理后台（管理操作全部由 CLI 承担）。
- 阅读形态：帖子 post（标题可空、首页可展开）和长文 article（标题必填、进入详情阅读全文）；均按 Markdown 顺序组合文字、图片、视频、音频和作品引用，并有稳定 URL。
- 付费预览策略（按内容独立配置）：全文预览 / 百分比预览 / 自定义截断标记 / 完全付费。预览不改变作品分区、会员身份或互动权限。

## 2. 总体架构

```
[浏览器]
   │  仅同源访问 www.example.com（含 /api/* BFF 代理）
   ▼
[Vercel] Next.js 15（SSR；不含业务密钥）
   │  BFF 转发：HttpOnly Cookie → Authorization: Bearer
   │    + X-Client-IP（取自 Vercel 平台可信来源，不透传浏览器头）
   │    + X-BFF-Token（BFF 身份共享密钥，仅用于来源标识与 IP 归因）
   ▼
[阿里云 ECS · Docker Compose]
   ├─ caddy     自动 TLS；覆写 X-Forwarded-For 为连接方真实 IP
   ├─ api       Hono：鉴权、权益、兑换、媒体签名 URL（只认 Bearer，不认 Cookie）
   └─ postgres  PostgreSQL 16（仅 docker 内网，5432 不出网）
        │
        ├─► 阿里云 OSS：统一私有桶（一切媒体经短期签名 URL 访问，ADR-0006）
        └─► 邮件：DirectMail SMTP（注册/重置验证码；开发用 Mailpit）

[本地 CLI] ──SSH 隧道──► PostgreSQL；──最小权限 RAM──► OSS
```

关键边界：

- **所有管理操作不经 Web API**。v1 的 API 仅暴露用户侧端点，攻击面最小。
- **权限校验全部在服务端**，且只在 API 层实现一次（packages/core）。付费正文不进入未授权响应；web 层只转发身份，不做授权判断。
- 三种付费形态（单篇/合集/订阅）共用一套 Entitlement 模型与 `canAccess` 校验，见 ADR-0002。
- **统一商品**：对外只售标准订阅（¥29.9/月，全站解锁，到期回落锁定），唯一入口为激活码兑换；单篇/合集 grant 不出售，仅保留模型与 CLI 能力用于存量兼容和运营赠送。

## 3. 技术选型

| 模块 | 选型 | 说明 |
|---|---|---|
| 前端框架 | Next.js 15（App Router）+ React 19 | 付费页面必须 SSR，响应中只含裁剪后内容 |
| 样式 | Tailwind CSS v4 | CSS-first 配置（`@import "tailwindcss"`），无 tailwind.config.js |
| UI 组件 | shadcn/ui | CLI 按需添加，组件源码入 `apps/web/components/ui`，不预装全集 |
| 交互原语 | Radix UI | 随 shadcn 组件按需带入，可访问性内置 |
| 正文排版 | @tailwindcss/typography | `@plugin` 注册；`prose` + 中文排印调优 |
| 图标 | lucide-react | shadcn 默认搭配 |
| 视频/音频 | Video.js 10（`@videojs/react`） | 模块化 features 组合；不使用 v8 全局 `videojs()` API；按需加载 |
| 图集 | Embla Carousel | 经 shadcn Carousel 引入 |
| Markdown | unified / remark AST | 预览截断基于渲染后块结构 |
| 后端 | Hono（Node runtime） | 轻量，路由即 API |
| ORM / 迁移 | Drizzle + drizzle-kit | schema 即文档，迁移可追踪 |
| 数据库 | PostgreSQL 16 | 事务保证兑换幂等 |
| 密码 | argon2id | — |
| 会话 | DB Session + HttpOnly Cookie（host-only） | 可撤销，30 天滑动过期 |
| OSS | ali-oss SDK | 统一私有桶 + 签名 URL |
| 邮件 | nodemailer（SMTP） | 生产接 DirectMail SMTP，开发用 Mailpit，一套代码 |
| 验收 | 独立子 agent | 按变更影响现场验证真实用户路径，记录证据与未覆盖项 |

明确排除：Magic UI、Aceternity 及一切动画框架；HLS 转码、DRM 与视频处理平台；Redis、消息队列与工作流引擎；微服务。

## 4. Monorepo 结构（pnpm workspaces）

```
yoryon/
├─ apps/
│  ├─ web/        # Next.js 前端 → Vercel（含 BFF 代理与 shadcn 组件源码）
│  ├─ api/        # Hono 后端 → 阿里云 Docker
│  └─ cli/        # 命令行：发布/合集/激活码/权益/用户/GC → 本地运行
├─ packages/
│  ├─ db/         # Drizzle schema + 迁移 + 客户端
│  ├─ core/       # 领域逻辑：canAccess、预览截断、激活码、邮件（api 与 cli 共用）
│  └─ config/     # 环境变量校验（zod）、共享类型与常量
├─ deploy/        # docker-compose.yml、Caddyfile、备份脚本
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
  id uuid pk, type text not null check (type in ('article','post')),
  slug text unique not null, title text not null, description text not null default '',
  body_markdown text not null default '',
  status text not null default 'draft' check (status in ('draft','published')),
  visibility text not null default 'public' check (visibility in ('public','paid')),
  preview_mode text not null default 'full' check (preview_mode in ('full','percent','marker','none')),
  preview_percent int check (preview_percent between 1 and 99),
  cover_media_id uuid references media_assets,
  published_at timestamptz, created_at timestamptz, updated_at timestamptz,
  is_pinned boolean not null default false   -- 首页置顶（post/article，CLI 管理；仅影响 /api/feed 排序）
)
create index on contents (status, published_at desc);

media_assets(
  id uuid pk,                             -- 不可枚举 UUID
  oss_key text unique not null,           -- 内容寻址：media/<sha256>.<ext>（ADR-0006）
  mime_type text not null, size_bytes bigint,
  duration_sec int, width int, height int, created_at timestamptz
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
  grant_days int,                         -- 权益有效期天数；null = 长期；subscription 必填
  max_uses int not null default 1, used_count int not null default 0,
  expires_at timestamptz,                 -- 码本身的有效期（非权益有效期）
  status text not null default 'active' check (status in ('active','disabled')),
  note text not null default '', created_at timestamptz,
  check (grant_type <> 'subscription' or grant_days is not null),
  check (grant_type <> 'content' or grant_content_id is not null),
  check (grant_type <> 'collection' or grant_collection_id is not null)
)

redemptions(
  id uuid pk, code_id uuid not null references activation_codes,
  user_id uuid not null references users,
  created_at timestamptz,
  unique (code_id, user_id)               -- 幂等兜底（ADR-0002）
  -- 撤销状态不在此表：单一状态源在 entitlements（1:1 join 推导展示）
)

entitlements(
  id uuid pk, user_id uuid not null references users,
  scope_type text not null check (scope_type in ('content','collection','subscription')),
  scope_id uuid,                          -- content/collection 的 id；subscription 恒为 null（覆盖全部付费内容）
  valid_from timestamptz not null,
  valid_until timestamptz,                -- null = 永久
  redemption_id uuid unique not null references redemptions,  -- 1:1，授予事实不可变
  revoked_at timestamptz,                 -- 单调状态字段：NULL → 值，不可逆
  revoked_by uuid references users,
  revoke_reason text not null default '',
  created_at timestamptz
)
create index on entitlements (user_id, scope_type, scope_id);

-- Analytics 原始事件（ADR-0007，口径见 docs/analytics.md）
-- event_type/target_kind/placement 的枚举约束在应用层（ingest Zod 白名单），DB 为 text 列
analytics_events(
  id uuid pk,
  event_id uuid unique not null,          -- 幂等键：客户端生成，重试去重
  event_type text not null,               -- impression | click | view | read
  target_kind text not null,              -- work | collection
  target_id uuid not null,                -- 多态引用，无 FK：目标删除后历史统计保留
  placement text,                         -- home_feed | collection_list，仅 impression/click
  page_view_id uuid not null,
  session_id uuid,                        -- sessionStorage 级匿名标识；不存 IP/UA/URL
  received_at timestamptz not null default now()   -- 服务端可信接收时间
)
create index on analytics_events (target_kind, target_id, received_at);
create index on analytics_events (received_at);
```

语义约定：

- **订阅** = `scope_type='subscription'` 且 `scope_id IS NULL`，覆盖全部付费内容（v1 无范围配置）。
- **订阅区间链**：每笔订阅权益是独立区间 `[valid_from, valid_until]`。兑换时
  `base = max(now, 用户未撤销订阅权益中 valid_until 的最大值)`（无订阅记录则 `base = now`；
  已存在永久权益（`valid_until IS NULL`）时 `base = now`，新区间仅作事实记录）；
  `valid_from = base`，`valid_until = base + grant_days`。连续兑换两个 30 天码 → 覆盖 60 天。
- **有效订阅** = 未撤销订阅区间对 `now` 的覆盖（区间并集语义，**不是全局 MAX**——撤销中间一笔会产生空洞，区间判断才正确）。
- **撤销** = 单笔权益区间作废，其余区间不重排、不重算；需要整体缩短时逐笔撤销或由 CLI 手动授予补偿。
- **合集授权动态解析**：校验时查合集当前成员，合集新增内容自动被既有授权覆盖（不做快照）。
- **权益授予事实不可变**：行不删除、区间不修改；`revoked_at/revoked_by/revoke_reason` 为单调状态字段（ADR-0002）。

## 6. 核心领域逻辑（packages/core）

### 6.1 统一权益校验

```ts
canAccess(user, content, now):
  if content.status != 'published' → false（对外不可见）
  if content.visibility == 'public' → true
  if user?.role == 'admin' → true
  if !user → false
  存在 entitlement e：
    e.user_id = user.id AND e.revoked_at IS NULL
    AND e.valid_from <= now AND (e.valid_until IS NULL OR e.valid_until > now)   -- 区间覆盖
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
- 缺省值 fail-closed：付费文章未配置 preview 时按 `none` 处理（公开文章缺省 `full`）；`marker` 模式找不到标记时正文整体视为付费区，且发布入口直接拒绝缺少标记的内容。全篇免费预览必须显式声明 `full`。
- `percent`：按顶层块权重累计。文本块按字符数计权；媒体块（图片/视频/音频）为**原子单位**，按固定等价字符数计权（默认 300，可配置），要么整块在免费区、要么整块在付费区，绝不截断一半。预算落在纯文本段落/标题内部时，按字符进一步截取其前缀（媒体、HTML 等原子节点所在的段落保守归入付费区）。
- 截断在 AST 层进行，绝不直接切割 Markdown 源码。

### 6.3 媒体访问控制（ADR-0004 + ADR-0006）

所有媒体（正文媒体与封面）统一存于私有桶，一律经 `GET /api/media/:id` 验权。放行规则（满足任一）：

1. 媒体为任一已发布内容或合集的**封面** → 放行（封面恒为 free）；
2. 媒体在任一已发布内容中 `exposure='free'` → 放行；
3. 当前用户对任一引用该媒体的内容通过 `canAccess` → 放行；
4. 否则 403。

配套规则：

- 规则 1/2 命中时响应身份无关：302 允许共享缓存（`Cache-Control: public, max-age=300`，必须小于签名 TTL 900s）；规则 3 命中时 `private, no-store`。
- 签名 URL TTL 15 分钟；媒体字节响应在上传时设置 `Cache-Control: private, max-age=604800`（内容寻址、不可变，浏览器私有缓存 7 天）。
- 同一媒体被多个内容引用时 `free` 优先（它事实上已公开）。
- 媒体 ID 使用不可枚举 UUID；任何代码路径不得生成长期有效的媒体 URL。
- **撤销时效边界（媒体访问合同的一部分）**：媒体从免费转为付费（或权益撤销）后，`/api/media/:id` 的验权立即生效——后续请求不再命中规则 1/2，新签名 URL 停止签发。但已签发的 302/签名 URL 在 TTL（最长 15 分钟）内仍可直接从 OSS 取回字节；这是签名 URL 分发的固有特性，系统不承诺追回已投递到客户端的字节。免费 302 的共享缓存 `max-age=300` 小于签名 TTL，保证共享缓存先于签名过期。运营上若需紧急下架，应直接删除/替换 OSS 对象（GC 或手动），而不是依赖验权。
- 独立付费图片/视频/音频内容：标题与描述免费，媒体本体恒为 paid，不参与百分比预览（v1 语义）。

### 6.4 激活码兑换（幂等 + 防超发 + 订阅接续，ADR-0002）

```
BEGIN;
SELECT id FROM users WHERE id = ? FOR UPDATE;                 -- 串行化同一用户的所有兑换
SELECT * FROM activation_codes WHERE code = ? FOR UPDATE;     -- 串行化同一码的并发兑换
码不存在 / 已停用 / 已过期 / grant 引用无效 → ROLLBACK，返回对应错误
SELECT * FROM redemptions WHERE code_id = ? AND user_id = ?;
  → 已存在：COMMIT，返回已有权益（幂等成功，不动计数）
UPDATE activation_codes SET used_count = used_count + 1
  WHERE id = ? AND used_count < max_uses;
  → 0 行：ROLLBACK，返回"已兑完"
INSERT redemptions;
INSERT entitlements：
  content/collection → valid_from = now，
                       valid_until = grant_days IS NULL ? NULL : now + grant_days
  subscription       → base = max(now, 用户未撤销订阅权益的 max(valid_until))，
                       valid_from = base，valid_until = base + grant_days
COMMIT;
-- 唯一约束 (code_id, user_id) 兜底：捕获 23505 → 重新查询，按幂等成功返回
```

### 6.5 内容发布与媒体生命周期（ADR-0006）

CLI 发布采用**分阶段、可安全重试**的流程；OSS 与 DB 无共同事务，以"上传幂等 + 单事务提交 + 延迟 GC"保证一致性。

**发布流程（`blog publish`，按 slug upsert，幂等）：**

- 阶段 A（准备）：解析 frontmatter 与正文 → 计算媒体清单及 sha256 → 逐个上传 OSS（`media/<sha256>.<ext>`；先 HEAD，存在即跳过；有限重试）。任一上传失败 → 中止，DB 零变更；重跑命令自动续传。
- 阶段 B（提交）：**单个 DB 事务**完成：`media_assets` upsert（`ON CONFLICT (oss_key) DO NOTHING`）→ 内容 upsert（按 slug）→ 替换 `content_media`（含 exposure 重算）→ 替换 `content_tags` → 合集成员变更。
- **发布成功的唯一判定 = 阶段 B 事务提交。**

**失败矩阵：**

| 场景 | 行为 |
|---|---|
| 部分媒体上传失败 | 中止，DB 零变更；重跑自动续传（已上传对象被 HEAD 跳过） |
| 上传全部成功 + DB 事务失败 | 孤儿对象暂存；重跑幂等收敛；残余由 GC 清理 |
| 更新已发布内容中途失败 | 旧版本保持在线（upsert 在单事务内生效） |
| 取消发布 / 删除 | 仅 DB 变更（`status='draft'` 或级联删除关联边）；OSS 对象不立即删除 |
| 曝光翻转（free↔paid） | 仅事务内更新 `content_media.exposure`，零 OSS 操作；无历史公开 URL 问题（统一私有桶，URL 恒为短期签名） |
| 多内容复用同一媒体 | 内容寻址使多文共享同一 `media_assets` 行；删除某内容只删关联边，对象保留 |

**垃圾回收（`blog media gc`，默认 dry-run，`--apply` 执行）：**

- 清理对象 ①：OSS 有对象但 DB 无 `media_assets` 记录，且对象年龄 > 24h（上传后事务失败的孤儿）。
- 清理对象 ②：`media_assets` 行存在，但零引用（无 `content_media` 边、非任何内容/合集封面）且超过 7 天宽限期。
- 删除前复核引用计数为零；宽限期保护进行中的发布。

**并发保护（GC ↔ 发布互斥）：**

GC 的“无 DB 记录 → 可删”判断与发布的“HEAD 存在 → 跳过上传 → 提交引用”存在竞态：若 GC 在发布的 HEAD 检查与阶段 B 提交之间删除对象，会产生悬挂引用（DB 引用已删除的对象）。重试场景下两阶段可能相隔数天，任何时间窗都无法消除该竞态，因此采用互斥：

- `blog publish` 与 `blog media gc` 在同一 PostgreSQL 上取**同一把会话级 advisory lock**（`pg_advisory_lock(hashtextextended('yoryon.media_publish_gc', 0))`）；发布从阶段 A 开始到阶段 B 提交全程持有。
- GC 使用 `pg_try_advisory_lock`：获取失败说明发布进行中，记录日志并跳过本轮（等待下轮 cron），不阻塞等待。
- 会话级锁随进程退出/连接断开自动释放，无残留锁；两进程本就连同一数据库，不引入新基础设施。
- 效果：发布与 GC 完全串行——要么发布先完成（GC 扫描时 `media_assets` 行已存在，不判为孤儿），要么 GC 先完成（发布 HEAD 未命中，重新上传）。两种顺序均无悬挂引用。
- unpublish / 删除内容只动 DB 边、不碰 OSS，与 GC 无竞态（7 天宽限期兜底），无需持锁。

## 7. API 契约（v1，仅用户侧；全部经 www 同源 BFF 代理）

```
POST /api/auth/register            { email, username, password } → 创建 pending 用户并发验证码
POST /api/auth/verify-email        { email, code }               → 激活账号
POST /api/auth/resend-code         { email, purpose }            → 重发（60s 冷却）
POST /api/auth/login               { emailOrUsername, password } → Set-Cookie（host-only）
POST /api/auth/logout
POST /api/auth/password-reset      { email } → 发码；{ email, code, newPassword } → 重置并撤销全部会话
GET  /api/auth/me

GET  /api/feed?cursor=             首屏信息流（仅内容条目，游标分页；不读 session，公开缓存；
                                   合集是顶层结构，只经 /api/collections → /c 列表曝光，不混排）
                                   排序键：coalesce(published_at, created_at) 经 date_trunc('milliseconds',·)
                                   截断（与 JS Date/游标毫秒精度对齐，微秒写入不分页错乱）；
                                   全序 (sortKey desc, id desc)；N+1 探测终止
GET  /api/contents/:slug           内容详情（按权益返回 full | preview；no-store）
GET  /api/collections              合集列表（不读 session，公开缓存；个人站量级不分页）
GET  /api/collections/:slug        合集页（成员按权益裁剪正文；no-store）
GET  /api/tags/:slug?cursor=       标签筛选（公开缓存）
GET  /api/media/:id                媒体验权 → 302 签名 URL（缓存策略见 §10）

POST /api/redemptions              { code } → 兑换（幂等）
GET  /api/me/entitlements          我的权益列表（含来源、区间与撤销状态）

POST /api/analytics/events         Analytics 批量 ingest（≤20 条/批且请求体 ≤32KB；Zod 白名单 + IP 限流；
                                   event_id 幂等去重；work 目标必须已发布，非法目标静默丢弃；ADR-0007）
```

约定：

- 错误格式统一 `{ error: { code, message } }`；幂等成功返回 200 + 已有权益。
- 仅 `status='published'` 的内容对外可见。
- 所有 mutating 端点经 BFF 的 Origin/Sec-Fetch-Site 校验（§9.2）后才到达 API。
- 限流在 API 侧按 §9.5 执行；管理操作无 API 端点，全部走 CLI。

## 8. 前端设计（ADR-0005）

### 8.1 设计原则

- 浅蓝灰品牌色，页面与阅读区背景一致；支持 Light / Dark（class 策略，dark 变量经 `:root[class~="dark"]`），账户菜单用一个双态开关切换，默认浅色。
- 首页为**轻量时间线信息流**：以分隔线与留白组织条目，不把内容套进企业后台风格的 Card；文章不强制封面。
- 保持单栏阅读宽度，不另设应用式界面；加载/空态/错误/重试态齐备；不引入任何动画框架。

### 8.2 组件方案

- shadcn/ui：`npx shadcn@latest init` 初始化，`npx shadcn@latest add <name>` **按需添加**，组件源码入 `apps/web/components/ui`，不预装全集；Radix 原语随组件依赖带入。
- 首批组件范围由页面清单驱动（Button、Input、Form、Dialog、Sheet、Badge、Skeleton、Toast、DropdownMenu、AspectRatio、Carousel 等），用到才装。

### 8.3 正文排版

- Markdown 渲染结果统一套 `prose`（dark 下 `prose-invert`）；详情阅读列最大 660px，正文使用系统衬线字体，桌面 17px / 1.85、640px 及以下 16px / 1.85。导航容器仍为 `max-w-3xl`，界面使用无衬线字体，信息流正文独立保持 15px / 24px。
- 页面浅色背景为 `#ffffff`，深色为 `#151514`；蓝灰品牌控件、强调色与交互语义保留。字体、可选要点卡片、统一 Caption 和媒体语法的当前约定见 [Markdown 写作与渲染规则](markdown-rendering.md)。

### 8.4 多媒体播放

- Video.js 10：使用 `@videojs/react` 的模块化 API（`createPlayer({ features })` 按需组合），**不使用 v8 的全局 `videojs()` / id 注册表 API**；实现时以安装版本官方文档为准并锁定版本。
- **按需加载**：视频播放器经 `next/dynamic` 懒加载，视口内读取真实首帧；音频使用固定控件和原生 `audio`，首次点击在同一用户手势内加载并播放，保持相同控件，不要求再次点击。媒体入口无卡片背景，shownotes 走正文 Markdown；切换媒体、离开视口或卸载时释放播放资源。
- 私有媒体播放：播放器 `src` 恒指向 `/api/media/:id`（302 → 15 分钟签名 URL）。签名 URL 过期或网络错误时，播放器捕获 error，重新请求端点获取新 URL、重置 `src` 并恢复 `currentTime`。
- OSS 签名 GET 原生支持 HTTP Range（206 断点/拖拽）；v1 仅直接文件播放，无需桶级 CORS 配置（不启用 HLS/字幕/画布能力；未来需要时再开白名单）。

### 8.5 页面清单

| 路由 | 说明 |
|---|---|
| `/` | 首页：纯内容信息流（条目 = 标题/封面/简介 + 类型/标签，点进详情）；对所有人一致，可公开缓存 |
| `/p/[slug]` | 内容详情（文章/图集/视频/音频）；按权益渲染全文或预览 + 解锁引导；左上角返回恢复来源列表位置 |
| `/c` | 合集列表页：全部合集（公开缓存） |
| `/c/[slug]` | 合集页：合集信息 + 成员内容流（按 sort_order） |
| `/tags` | 仅标签索引；旧 `/explore` 重定向至此；探索菜单只含合集和标签 |
| `/tags/[slug]` | 标签筛选结果，支持返回与追加分页位置恢复 |
| `/search` | 独立搜索页；返回保留查询、服务器会话与已加载分页，重新核验当前权限 |
| `/subscription` | 会员状态及会员作品 / 会员问答两个tab |
| `/login` `/register` | 认证页（注册含邮箱验证码步骤） |
| `/redeem` | 激活码兑换框 + 已获得权益列表（极简，非个人中心） |

## 9. 认证、会话与安全（ADR-0001）

### 9.1 Cookie 职责

| 属性 | 值 | 职责 |
|---|---|---|
| Domain | 不设置（host-only `www.example.com`） | 作用域最小化，任何其他子域不可见 |
| HttpOnly | 是 | 防 XSS 窃取 |
| Secure | 是 | 仅 HTTPS 传输 |
| SameSite | Lax | 浏览器默认防线：跨站请求不携带 |
| Path | / | — |
| 有效期 | 30 天滑动（剩余 <15 天时续期） | 平衡体验与暴露窗口 |

### 9.2 CSRF 防护

BFF（Route Handler 中间件）对所有 mutating 方法（POST/PUT/PATCH/DELETE）执行：

1. `Origin` 存在且 ∈ 白名单（生产：`https://www.example.com`；开发：`http://localhost:3000`）→ 放行；
2. `Origin` 缺失 → 要求 `Sec-Fetch-Site ∈ {same-origin, none}`（同源导航或非浏览器客户端），满足则放行；
3. 其他（Origin 非法/不匹配，或 Sec-Fetch-Site 为 cross-site/same-site 跨子域异常）→ 403 并记日志。

GET/HEAD/OPTIONS 豁免（系统不存在可变更状态的 GET）。SameSite=Lax 下跨站 POST 本就不携带 Cookie，Origin 校验为纵深防御（老浏览器、未来子域变化）。API 只认 Bearer，浏览器不会自动附加，API 侧无需再设 CSRF 机制。

### 9.3 Session 生命周期

- 登录：创建会话（32 字节随机 token，库中存 sha256），Set-Cookie。
- 登出：删除会话行。
- 密码重置 / 修改密码：撤销该用户**全部**会话。
- 禁用用户：会话校验时联查 `users.status`，即时失效。

### 9.4 BFF ↔ API 信任与鉴权一致性

- Bearer 是唯一身份凭证；`X-BFF-Token`（共享密钥，仅存于 Vercel 与 api 环境变量）**只用于来源标识与 IP 归因，绝不参与授权**。
- 直连 `api.example.com` 合法但无环境凭证（Cookie 为 www host-only，浏览器直连不携带）；持同一 Bearer 直连与经 BFF 等效。
- SSR `apiFetch` 与浏览器 Route Handler **共用同一个 Cookie→Bearer 转发模块**（附 `X-Client-IP`、`X-BFF-Token`，强制 `cache: 'no-store'`）。web 层不做任何授权判断，授权只在 API（packages/core 单实现），不存在两套权限逻辑。

### 9.5 客户端 IP 解析与限流

IP 解析优先级（API 侧）：

1. `X-BFF-Token` 校验通过 → 采用 `X-Client-IP`（必须可解析为 IP，否则降级）；
2. 否则 → Caddy 覆写后的 `X-Forwarded-For`（直接访问者的真实 IP；Caddy 丢弃客户端传入的 XFF）；
3. 均不可用 → 归入 `unknown` 桶（阈值更严）。

配套规则：BFF 从 Vercel 平台来源取客户端 IP，**绝不透传**浏览器提供的 `X-Forwarded-For` / `X-Real-IP`；审计日志记录解析后 IP 与来源（bff/direct/unknown）。

限流（单实例内存令牌桶）默认阈值：

| 操作 | 维度与阈值 |
|---|---|
| login | 5 次/分钟/IP；5 次/5 分钟/账户 |
| register | 3 次/小时/IP |
| resend-code / verify-email | 60 秒重发冷却；单码 5 次尝试 |
| redeem | 10 次/分钟/用户；20 次/分钟/IP |
| password-reset | 3 次/小时/IP + 账户 |
| IP 缺失/不可解析 | 统一 `unknown` 桶，上述阈值减半 |

边界声明：该方案**仅保证单实例一致性**——重启清零、多实例各自独立计数。v1 为单实例部署，可接受；未来水平扩展时需引入外置存储并重新评估，不提前建设。

## 10. 缓存策略（ADR-0003）

| 响应 | 策略 |
|---|---|
| `/api/feed`、`/api/tags/:slug`、`/api/collections`（对所有人一致） | `Cache-Control: public, max-age=60, stale-while-revalidate`；端点实现中**不允许读 session** |
| 内容详情、`/api/me/*`、兑换 | 页面 `force-dynamic` + fetch `no-store`；响应 `Cache-Control: private, no-store` |
| `/api/media/:id` 302 — 命中免费规则（§6.3 规则 1/2，身份无关） | `Cache-Control: public, max-age=300`（必须 < 签名 TTL 900s） |
| `/api/media/:id` 302 — 命中权益规则（§6.3 规则 3） | `Cache-Control: private, no-store`（缓存付费 302 = 签名 URL 泄露） |

硬性规则：任何渲染权益相关内容的页面禁止 ISR/revalidate；任何读取 session 的端点必须 no-store。由独立子 agent 现场验收（§13）。

## 11. CLI 管理工具（apps/cli）

```
blog publish <dir|file>          # 两阶段发布（§6.5）：解析 → 上传媒体 → 单事务提交；按 slug upsert，可安全重试
blog unpublish <slug>            # status → draft（不动 OSS 对象）
blog collection create|list|sort ...    # 成员增删只经文章 frontmatter collections + 发布（唯一事实源）
blog tag list
blog code create --grant-type content|collection|subscription
                 [--content slug | --collection slug]
                 [--days N]                       # subscription 必填；其余缺省 = 长期
                 --count N [--max-uses N] [--expires DATE] [--note ...]
blog code list|disable
blog redemption list             # 撤销状态经 1:1 entitlement join 展示
blog entitlement list
blog entitlement revoke <id> --reason ...         # 撤销单笔权益（单调状态，记录操作者）
blog entitlement grant --user ... --scope ... [--days N]   # 手动补偿授予（生成系统 redemption 记录）
blog user list|disable|promote
blog db tunnel                   # 建立到生产库的 SSH 隧道（用完自动断开）
blog media gc [--apply]          # 默认 dry-run：孤儿对象 / 零引用资产清理（§6.5）
blog analytics overview|top|content <slug>|collection <slug> [--days N]   # 内容表现统计（docs/analytics.md）
blog analytics prune --days N    # 清理早于 N 天的原始事件（保留策略 365 天）
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
preview: { mode: percent, percent: 30 }   # full | percent | marker | none；付费文章缺省 = none，公开文章缺省 = full；marker 缺失 <!-- more --> 拒绝发布
tags: [tag-a, tag-b]
collections: [collection-slug]
published_at: 2026-01-01
---
```

## 12. 部署与运维

- **域名**：`www.example.com` → Vercel；`api.example.com` → ECS（Caddy 自动 TLS）。需自有域名；ECS 在境内需备案。Vercel 境内访问不稳定，若读者主要在境内，web 层可整体平移阿里云（前后端已解耦，BFF 代理摘掉即可直连）。
- **Caddy**：终止 TLS；`reverse_proxy` 覆写 `X-Forwarded-For` 为连接方真实 IP（丢弃客户端传入值）。
- **docker-compose**：`postgres`（数据卷）+ `migrate`（建表/迁移，`service_completed_successfully` 后才启动 `api`）+ `api` + `caddy`。Postgres 仅容器内网与宿主机回环（SSH 隧道）；Caddy 为唯一公网入口。
- **存量库升级预检**：0001 迁移把 `users.username` 转为 citext（大小写不敏感唯一）。若历史库已存在仅大小写不同的用户名（如 Alice / alice），迁移会因唯一约束冲突失败——迁移在单事务中执行，失败即整体回滚，数据库保持一致（变更涉及迁移时由独立子 agent 现场验收）。升级前先执行预检并人工合并冲突账号：
  ```sql
  SELECT lower(username), count(*) FROM users GROUP BY 1 HAVING count(*) > 1;
  ```
- **凭证分离**：api 运行时 DB 用户（无 DDL）/ migrator / CLI 管理用户三者分离；OSS 两个 RAM 身份——api 仅私有桶 GetObject/签名，CLI 发布身份才有 Put/Delete；桶级管理权限不授予任何一方。所有密钥只存在于环境变量，不进仓库。
- **关键环境变量**：web 侧 `API_INTERNAL_URL`、`BFF_SHARED_SECRET`；api 侧 `DATABASE_URL`、`OSS_*`、`MAIL_SMTP_*`、`BFF_SHARED_SECRET`、`MEDIA_SIGN_TTL=900`；cli 侧 `DATABASE_URL`（经隧道）、`SSH_HOST`、`OSS_*`（发布身份）。
- **CLI 连接生产**：默认 SSH 隧道（`blog db tunnel`）；已使用 Tailscale 时可走私有网段直连。5432 永不暴露公网。
- **备份**：每日 cron `pg_dump | gzip` → OSS 私有备份桶（lifecycle 保留 30 天）。
- **日志**：api 结构化日志（请求 id、用户 id、解析后 IP 及来源、耗时），不记录密码、验证码、激活码明文、签名 URL 参数。

## 13. 独立子 agent 验收

验收规则以根目录 `AGENTS.md` 为准。不维护固定测试套件、断言脚本或合成 fixture/harness；由独立子 agent 按实际变更选择用户路径、失败方式和边界，现场执行浏览器、CLI、API、SQL、媒体字节及最终可见结果核对。

涉及认证与付费内容时覆盖登录、预览、兑换、撤权和缓存隔离；涉及发布与存储时覆盖幂等、失败恢复、媒体访问和 GC 并发；涉及前端时覆盖深浅主题、手机视口、错误与重试。上述是按影响选择的业务风险，不是固定断言清单。

使用隔离数据库、配置与存储，记录 PASS / FAIL / UNVERIFIED / UNKNOWN 和未覆盖项。工件放入 `artifacts/<运行名>/`，留存版本、实际命令、环境与必要脱敏证据；不新增可执行测试程序。构建、HTTP 成功或历史报告不能单独证明业务通过。

## 14. 帖子、长文与互动

作品阅读形态为 post/article：帖子首页可折叠展开，长文进入详情阅读全文；媒体按 Markdown 编排顺序展示，作品引用使用稳定 ID，公开卡片仅返回目标当前允许的摘要。发布、缓存依赖、迁移与失败边界见 [ADR-0014](adr/0014-post-article-references.md)。两种详情沿用同一评论、回复、点赞与站内通知领域；会员问答是独立领域，不伪装为作品。

## 15. ADR 索引

| 编号 | 决策 | 状态 |
|---|---|---|
| [ADR-0001](adr/0001-bff-proxy-auth.md) | BFF 代理 + Bearer 转换的身份传递方案 | 已接受（2026-10-11 补充修订） |
| [ADR-0002](adr/0002-append-only-entitlements.md) | 统一权益模型：授予事实不可变与兑换幂等 | 已接受（2026-10-11 修订） |
| [ADR-0003](adr/0003-cache-separation.md) | 缓存分线：付费内容不进共享缓存 | 已接受（2026-10-11 补充修订） |
| [ADR-0004](adr/0004-media-exposure-contract.md) | 媒体曝光合同：发布期计算 exposure 字段 | 已接受（桶策略由 ADR-0006 取代） |
| [ADR-0005](adr/0005-frontend-stack.md) | 前端技术选型：shadcn/ui + Tailwind v4 + Video.js 10 | 已接受 |
| [ADR-0006](adr/0006-media-lifecycle.md) | 媒体存储与发布生命周期：统一私有桶、内容寻址、分阶段发布、延迟 GC | 已接受（2026-10-11 补充修订：GC 并发互斥） |
| [ADR-0007](adr/0007-analytics-v1.md) | Content Analytics V1：单事件表、多态 target 无 FK、event_id 幂等、隐私最小化 | 已接受 |
