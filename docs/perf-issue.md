# Issue：性能改造——资源消耗与加载速度

> 状态：待评审（v2，已纳入一轮源码复核意见） ｜ 类型：性能（多批次） ｜ 范围：`apps/web`、`apps/api`、`packages/core`、`packages/db`、`apps/cli`
> 依据：双通道独立 review——parent（Kimi）逐文件核查 + reviewer 子代理（openai/gpt-6-astra:xhigh）深度审计；详细证据与机制分析见 [`docs/perf-review-gpt6.md`](./perf-review-gpt6.md)。
> 审计边界：纯源码审计，未跑构建 / E2E / Lighthouse / 生产请求 / SQL。所有"影响量化"为条件模型，需按 §6 验证计划实测。

## 修订记录

- **v1**：初版（12 条发现 + 三批次方案）。
- **v2**：纳入源码复核的 8 条修订——① outbox 从"远期"提前至批次二；② 免费媒体共享缓存（s-maxage）暂缓，移出批次二；③ 失效目标集合改为事务内计算（覆盖旧关联）；④ 封面 16:9 统一方案改为按内容类型分治；⑤ 明确 Data Cache / Full Route Cache 分层职责与标签生命周期验证；⑥ 新增 session 条件写入优化（P1）；⑦ 权益批量化以 `canAccessMany()` 落地并保留三种授权语义；⑧ 索引优化改为批次一先 EXPLAIN 取证、证据不足不动索引。

## 1. 目标

| 维度 | 目标 |
|---|---|
| 资源消耗 | 缓存**业务变缓存变**（on-demand invalidation），取消短周期计时器式刷新，长 TTL 仅作兜底；降低 Vercel Function invocations / ISR writes / 回源 API 调用 |
| 加载速度 | Chrome Lighthouse（production build、移动档）首页与详情页 Performance **≥ 90**；分页点击加载链路清晰、无重复请求 |

非目标：不改动付费权益/鉴权安全合同（ADR-0003/0004 的私有线 no-store 语义保留）；不为性能牺牲媒体访问撤销能力；不引入大型网络字体。

## 2. 发现汇总（按严重度）

| # | 严重度 | 发现 | 证据 |
|---|---|---|---|
| F01 | P1 | 公开数据默认 60s 时间驱动刷新，全库无 `revalidateTag`/`revalidatePath`/失效 webhook，发布直接写 DB | `apps/web/app/page.tsx:8`、`app/tags/[slug]/page.tsx:9-10`、`app/c/page.tsx:22`、`apps/web/lib/api.ts:33-37`、`apps/cli/src/commands/content.ts:33-60` |
| F02 | P1 | `/c` 每次动态渲染（force-dynamic）；`/tags/[slug]` 无 `generateStaticParams`，route 级 `revalidate=60` 不构成可靠 Full Route ISR；公开页面持续消耗 Function invocations | `apps/web/app/c/page.tsx:15`、`app/tags/[slug]/page.tsx:9-17`、Next `dist/build/static-paths/app.js` |
| F03 | P1 | sitemap force-dynamic + 串行全量游标翻页 no-store，单次请求最多 1,001 次 API 调用；N=10k 时约 501 次 API/约 1,000 条 SQL | `apps/web/app/sitemap.ts:11-14,39-62` |
| F04 | P1 | 媒体 302 仅有 `public, max-age=300`（浏览器层），CDN 共享命中未证实；feed 每张未缓存封面 = 1 次 BFF Function + 1 次 API（DB 查询+签名）。**v2：共享缓存改造暂缓，见 §3.4** | `apps/api/src/routes/media.ts:18-39`、`apps/web/app/api/[...path]/route.ts:49-55,89-92`、`packages/config/src/constants.ts:23-25` |
| F05 | P1 | 认证中间件对所有 API 请求执行会话 SELECT+UPDATE（含匿名语义的 feed/tags/analytics/免费媒体）；**v2 补充：`lastUsedAt` 每次请求无条件 UPDATE 本身即是写放大，与路由是否匿名无关** | `apps/api/src/app.ts:51-52`、`middleware/auth.ts:30-61`、BFF `route.ts:35-38,83-87` |
| F06 | P1 | 播放器对任意 error 无界重试且每次改 URL（`?r=N`）：持续 403/404/格式错误时产生无限 BFF/API 请求循环 | `apps/web/components/player.tsx:22-41,49-56,68-74` |
| F07 | P1 | feed/tags 列表查询 `select()` 全列（含 `body_markdown` 全文）后丢弃，DB→API 传输放大；sitemap 复用 feed 接口成倍放大 | `apps/api/src/routes/contents.ts:57,246`、`packages/db/src/schema.ts:84` |
| F08 | P1 | 封面/正文/图集图片无 width/height（CLS 风险），无 srcset/派生图，图集全部 eager 加载；发布链路未探测图片尺寸。**v2：修复方案按内容类型分治，见 §4 批次一第 4 条** | `components/feed-timeline.tsx:31-35`、`app/p/[slug]/page.tsx:99-105`、`components/markdown.tsx:40-42`、`packages/core/src/publish.ts:211-215` |
| F09 | P1 | feed/tags 排序键为表达式 `date_trunc('ms', coalesce(published_at, created_at))`，与现有 `(status, published_at)` 索引不匹配；合集详情对登录非管理员逐项 `canAccess`（N+1，100 篇付费成员 = 100 次串行 SELECT）。**v2：索引处置改为先取证，见 §4 批次一第 7 条；权益批量化的语义约束见 §3.5** | `contents.ts:55-60,199-224`、`schema.ts:95`、`packages/core/src/entitlements.ts:38-65` |
| F10 | P2 | 详情/合集页全动态（按权益设计，可保留），但 API 侧 tags/media/collections 关联查询串行；详情公开内容与付费内容没有拆分缓存路径 | `app/p/[slug]/page.tsx:16`、`contents.ts:95-139` |
| F11 | P2 | login/register/reset-password/redeem 四个纯表单壳页面 force-dynamic，每次访问白耗 SSR invocation；redeem 客户端还有 me→entitlements 两次串行请求 | 各 `page.tsx:6`、`components/redeem-client.tsx:33-50` |
| F12 | P2 | analytics 2s 窗口小批提交，详情页常规 2 次独立 invocation（view、read 分开）；非空转轮询，但装载率低 | `apps/web/lib/analytics.ts:39-41,82-107` |

### 交叉核对中已纠正的初判（避免按错误结论动工）

1. ~~"no-store 导致 generateMetadata 与 page 双倍 API 调用"~~ —— **不成立**。本仓库 Next 15.5.27 源码（`dedupe-fetch.js:59-75`）渲染期 GET 去重 key 不含 `cache` 字段，同渲染内相同请求仍合并。剩余仅是 JSON 重复解析的小优化。
2. ~~"媒体 302 完全无缓存"~~ —— 不准确。免费媒体已有 `max-age=300`（浏览器层）；未证实的只是 CDN 共享命中。
3. ~~"revalidate=60 是后台定时轮询"~~ —— 不准确。它是访问触发的到期阈值；问题本质是缺少业务驱动失效 + 兜底周期过短。

### 已确认做得对、不要动的地方

- 私有线（详情全文、付费媒体、auth/redemptions/me）private/no-store 边界清晰（ADR-0003/0004）。
- feed/tags 已是 keyset 游标分页 + 全序 + 多取一条探测终止 + tags 批量查询，毫秒截断解决微秒精度坑。
- `publish.ts` 发布操作已有明确事务边界，"事务提交即发布成功"——批次二的 outbox 设计必须建立在这个边界之上（§3.1）。
- Video.js 已 `dynamic(ssr:false)` 隔离出首页；react-markdown 纯服务端渲染；系统字体栈零下载；内联 theme script 防 FOUC 是有意设计。
- analytics 空队列不发请求、事件幂等去重、有界重试；error.tsx 不自动重试。
- `media_assets` 已有 width/height 可空字段、详情 API 已返回媒体尺寸——图片尺寸不需要重建元数据模型，只需补齐发布链路赋值与前端消费。

## 3. 关键设计约束（批次二动工前必须确认）

### 3.1 发布成功与缓存失效之间必须有事务保证（Outbox 提前至批次二）

v1 把 outbox 放在"远期"，但若兜底 TTL 改为 24h，"DB 已提交、webhook 投递失败"意味着错误缓存最长持续一天——不可接受。因此 outbox 与缓存改造**同批交付**：

- 利用现有 PostgreSQL 新增失效事件表，字段至少：`event_id`、`targets`、`status`、`attempts`、`next_attempt_at`。
- 事件在**发布事务内**插入（与内容写入同一事务提交）；事务提交后 CLI 立即尝试投递，失败由重试 worker 按 `next_attempt_at` 有界重试；消费端按 `event_id` 幂等。
- 不引入 Redis/Kafka 等额外基础设施。
- **验收语义区分**：webhook 返回 200 只代表"失效通知已受理"，不代表页面已更新。E2E 必须在收到成功后发起**真实页面请求**断言最终可见性，不得以 webhook 200 作为端到端通过条件。

### 3.2 失效目标集合在事务内计算，覆盖旧关联与删除

`publish.ts` 中标签/合集关联经历删除重建，**事务提交后旧关联已从 DB 消失**，无法凭新状态反推该失效哪些旧页面。因此：

- 受影响目标集合（旧+新标签、旧+新合集、feed、内容详情、sitemap）在**事务内**基于变更前后数据计算，随事件一起持久化。
- 删除操作同理：删除前必须把该内容涉及的全部失效目标写入事件。
- 缓存 tag 的命名与关联规则集中定义在一处（建议 `packages/core` 导出唯一 tag 注册表），CLI / API / Web 都从该处引用，避免规则散落四地。

### 3.3 明确 Data Cache 与 Full Route Cache 的分层职责

`publicFetch` 目前只用 `next.revalidate`，扩展 `next.tags` 前必须逐路由明确两层策略：

| 层 | 职责 | 对 `/`、`/c`、`/tags/[slug]` 的决策点 |
|---|---|---|
| Data Cache | 缓存服务端 fetch 的 API 响应 | tag 命名（`feed`/`collections`/`tag:<slug>`）、兜底 TTL |
| Full Route Cache | 缓存渲染后的页面结果 | `/c` 去 force-dynamic；tags 页是否按需 ISR |

- `generateStaticParams` 返回 `[]` 的按需 ISR 行为需在当前 Next 15.5.27 上**实测验证**，不能仅凭文档假设。
- 标签生命周期测试必须覆盖：**新标签创建后首次访问、不存在标签的 404 是否被缓存、标签删除后再重建同名标签**——不能只验证已存在标签的稳态。

### 3.4 免费媒体共享缓存（s-maxage）暂缓，移出批次二

现状 `media.ts` 的 `resolveMediaAccess → 免费 public,max-age=300 / 付费 private,no-store` 在当前"每请求都先鉴权"的前提下是安全的。引入 CDN 共享缓存后请求会绕过权限判定，带来两个必须先回答的问题：

1. **权限状态变化**：媒体从免费预览调整为付费后，CDN 缓存的旧 302 会继续放行签名 URL。
2. **签名剩余有效期**：共享缓存 TTL + 代理行为 + 时钟误差必须严格小于签名剩余寿命（当前签名 900s / 缓存 300s，余量约 600s 只是名义值）。

另外：**不得把免费/付费媒体统一走免认证逻辑**——即使某媒体对匿名开放，它也可能被受保护内容引用，豁免鉴权前必须评估该媒体的全部引用关系。

结论：批次二保留现有浏览器级 `max-age=300`，只做页面缓存主线与封面传输优化；共享缓存（s-maxage / 媒体 CDN）作为**独立评估项**后置，前置条件是明确免费转付费、下架、删除时的撤销要求与实测方案（`x-vercel-cache` 采样）。

### 3.5 权益批量化必须保留三种授权语义

`canAccess()` 覆盖单篇 content / 合集 collection / 全站 subscription 三种权益，且含 `validFrom`、`validUntil`、`revokedAt` 与 admin 特权。批量化时：

- 在 `packages/core` 新增独立的 `canAccessMany(user, contents[]) → Map<contentId, boolean>`，复用同一套判定语义（尤其不能漏掉"通过合集获得的授权"）。
- 单篇 `canAccess` 与批量 `canAccessMany` 共用一组语义测试，防两侧实现漂移。
- 禁止 `Promise.all(N × canAccess)`（连接池仅 10，串行慢变成并发挤占）。

## 4. 改造方案（三批次，每批独立可交付）

### 批次一：低风险直接修复（不动缓存架构）

1. **F06 播放器有界重试**：自动重签名刷新最多 1 次；持续失败停止并展示手动重试；网络错误有界退避；卸载取消。
2. **F07 列表查询投影**：feed/tags/合集成员查询显式 select 列表字段，排除 `body_markdown`。
3. **F05a session 条件写入（优先于路由豁免）**：`lastUsedAt` 改为有条件更新（距上次记录超过阈值才写），保留登录活动记录同时消除高频写放大；随后再按路由权限边界评估匿名接口跳过认证。
4. **F08 图片按内容类型分治**（v2 修订，放弃统一 16:9）：
   - Feed 封面：受控比例容器 + `object-fit: cover`（明确的 UI 裁切选择），加载前占位。
   - 图集详情：保留原始纵横比，用真实 width/height 预留空间；非首张 lazy。
   - 正文图片：消费媒体尺寸元数据，避免加载撑开页面。
   - 尺寸在**媒体入库时探测一次**（`publish.ts`），写入已有 width/height 字段，所有展示场景复用；旧素材补刷。
5. **F09b 权益批量化**：实现 `canAccessMany()`（约束见 §3.5），合集详情改用批量判定；合集成员查询同步做字段投影。
6. **F10a 关联查询并行化**：详情页 tags/media/collections 三条 SELECT 并行。
7. **F09a 索引取证（只测量，不改索引）**：用真实数据对 feed/tags 浅页、深页、热门标签跑 `EXPLAIN (ANALYZE, BUFFERS)`，记录扫描行数/排序方式/耗时。内容量小、证据不足时**不建索引**；确需优化时建与过滤+排序表达式一致的复合表达式索引，并对比前后执行计划。
8. **F11 表单壳静态化**：删除 login/register/reset-password/redeem 四个页面的 `force-dynamic`。

### 批次二：缓存主线（业务变缓存变 + 长时兜底 + 事务保证）

1. **失效基础设施（含 outbox，§3.1）**：PG 事件表随发布事务写入；CLI 提交后立即投递，失败有界重试；web 侧新增独立签名失效端点 `app/api/revalidate/route.ts`（HMAC + 时间戳 + event_id 防重放，不走 BFF 白名单，密钥不进浏览器），消费端幂等。
2. **失效目标事务内计算**（§3.2）：发布/更新/下架/删除/合集变更均在事务内计算旧+新受影响目标并持久化；tag 注册表集中在 `packages/core`。
3. **公开页面迁移**（§3.3）：`publicFetch` 支持 tags；兜底 TTL 由 60s 改 24h；`/c` 去 force-dynamic；tags 页按需 ISR（先验证 `generateStaticParams: []` 行为）；失效覆盖旧+新关联与 sitemap。
4. **失败不污染缓存**：区分"成功返回零条"与"取数失败"，失败时保留上次成功结果或让生成失败，不得写入空态长缓存。
5. **F03 sitemap 快照**：API 新增轻量 sitemap 端点（只选 slug/updatedAt，过滤 published）；web 侧走 tag 缓存快照；`lastModified` 用真实更新时间；失败保留旧快照。
6. **API 响应头**：`stale-while-revalidate` 补秒数或移除。
7. ~~免费媒体 s-maxage~~ **已暂缓**（§3.4）：本批次只做生产侧 `x-vercel-cache` 命中率采样取证，不改缓存头。

### 批次三：拓扑优化（需先完成批次二）

1. **详情公开壳 ISR + 私有权益动态**：API 新增身份无关公开 DTO（付费内容仅预览+公共元信息）；页面公开部分长 TTL + tag；全文客户端私有请求获取（预留容器防 CLS）。⚠️ 只删 force-dynamic 而继续用 apiFetch 不构成安全静态化。
2. **CDN 可缓存分页**：版本化分页快照（首页带 revision）或明确可 purge 的 CDN 缓存；快照不得含私有正文。
3. **图片派生图**：发布时生成白名单宽度档位，feed 返回 srcset 信息。
4. **媒体共享缓存独立评估**（§3.4 的后续）：以批次二的实测数据与撤销需求评审为前提。
5. **F12 analytics 聚合**：view/read 合并或延长有队列兜底窗口；若 invocation 是账单主项，评估独立采集域名。
6. 按真实 bundle 分析决定 Embla 独立边界、audio/video 拆分。

## 5. 验收标准

**功能与正确性（每批必过）：**
- `pnpm typecheck` 通过；相关 E2E（feed-pagination / collection-pages / media / analytics）通过。
- 新增 E2E：
  - 发布/更新/下架/删除后，**以真实页面请求**确认首页/标签/合集/sitemap 最终可见正确结果——webhook 200 不算通过（§3.1）；
  - 旧+新标签/合集关联同步失效（§3.2）；失效投递失败后由重试恢复，且 `event_id` 重放不产生重复副作用；
  - 标签生命周期：新建首访、404 缓存行为、删除后同名重建（§3.3）；
  - API 故障不覆盖成功缓存为空页/半份 sitemap；
  - 播放器永久失败的重试次数上限；
  - 登录态高频请求下 session `lastUsedAt` 写入被节流、匿名接口无 session UPDATE/Set-Cookie；
  - `canAccess` 与 `canAccessMany` 语义一致性测试（三种权益 + 有效期 + 撤销 + admin）。

**资源消耗（批次二、三后实测）：**
- 同业务量同窗口前后对照：Function invocations、ISR writes、CDN requests、回源 API 调用数下降；生产采样确认 `/` `/c` `/tags/*` 命中路由缓存。
- sitemap 单次请求回源 API 调用从 O(N/20) 降为 O(1)。

**加载速度（批次一、三后实测）：**
- production build 上对匿名首页、普通详情、图集详情各跑 ≥3 次 Lighthouse 移动档：Performance ≥ 90，记录 LCP/CLS/TBT 明细（CLS < 0.1，重点验证图片占位）。

## 6. 验证命令与环境前提

```bash
pnpm typecheck
pnpm --filter @yoryon/web build          # 检查 prerender manifest 的路由静态/动态分类（验证 §3.3）
pnpm --filter @yoryon/e2e test           # 需 docker:dev 依赖 + 隔离测试数据
# DB：EXPLAIN (ANALYZE, BUFFERS) 对 feed/tags 深浅页取证（批次一第 7 条，先于任何索引变更）
# 生产：curl -I 采样 x-vercel-cache / Age / Set-Cookie（匿名、跨浏览器、登录续期三组）
```

## 7. 不能承诺的事项（审计边界）

- 不承诺修复后 Lighthouse 必然 ≥ 90——需实测迭代。
- 不给出具体账单节省金额——量化均为条件模型。
- 媒体共享缓存化改变访问撤销合同，已暂缓为独立评审项（§3.4），不是纯性能改动。
- 生产 DB 可能存在 schema 之外的手工索引，F09 结论以生产 `EXPLAIN` 为准。

## 8. 附件

- 完整审计报告（机制级分析、逐路由缓存拓扑表、目标缓存拓扑图）：[`docs/perf-review-gpt6.md`](./perf-review-gpt6.md)
