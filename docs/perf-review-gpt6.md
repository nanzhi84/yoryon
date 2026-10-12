# Yoryon monorepo 深度性能 Review

> 历史证据：文中的测试套件与固定验证脚本已移除，不作为当前运行入口；后续验收遵循根目录 AGENTS.md 的独立子 agent 规则。
> 审计范围：`apps/web`、`apps/api`、`packages/core`、`packages/db`，以及相关部署配置、ADR 和 E2E 测试。  
> 版本依据：`apps/web/package.json:26`、`pnpm-lock.yaml:136-138`，并核对本地安装的 Next.js **15.5.27** 实现。  
> 审计方式：只读源码审计；没有运行构建、测试、Lighthouse、生产请求或 SQL。下文严格区分【已确认事实】与【推断／待生产验证】。未修改已有文件。
> 本文件由 review 子代理（openai/gpt-6-astra:xhigh）产出、parent 落盘；最终汇总 issue 见 `docs/perf-issue.md`。

## 摘要

**最值得优先处理的不是全面增加缓存，而是：减少 sitemap 全量回源、让公开页面真正命中路由缓存、消除高频请求上的无用认证，以及补齐图片尺寸与派生图。**

没有发现本次性能审计范围内需要定为 P0 的问题；有多项应在下一轮性能发布前解决的 P1。

### Top 发现表

| 编号 | 严重度 | 发现 | 主要影响 | 核心证据 |
|---|---|---|---|---|
| F01 | P1 | 公开数据默认 60 秒刷新，没有业务变更驱动失效链路 | 持续访问时的缓存刷新、ISR 写入及回源；发布新鲜度依赖时间窗口 | `apps/web/app/page.tsx:8-12`；`apps/web/lib/api.ts:33-37`；`apps/cli/src/commands/content.ts:33-60` |
| F02 | P1 | `/c` 每次动态渲染；`/tags/[slug]` 不能仅凭 `revalidate=60` 认定已经 ISR | 公开页面仍消耗 Function invocations，Data Cache 命中也不能免除渲染 | `apps/web/app/c/page.tsx:15-22`；`apps/web/app/tags/[slug]/page.tsx:9-17` |
| F03 | P1 | sitemap 每次请求串行全量分页，最多 1,001 次 API 请求 | 单次 Function 执行时间、API/DB 放大、超时风险 | `apps/web/app/sitemap.ts:11-14,25,39-62` |
| F04 | P1 | 封面仍需解析 BFF 302；现有免费缓存头不等于已经证实 Vercel CDN 命中 | 每张未缓存封面的 Function/API 请求；图片加载额外往返 | `apps/api/src/routes/media.ts:18-39`；`apps/web/app/api/[...path]/route.ts:49-55,89-102` |
| F05 | P1 | 公开分页、匿名 analytics、免费媒体的登录请求仍可能执行会话查询和写入 | 每个有效登录请求额外一次认证 SELECT、一次会话 UPDATE，续期还产生 Set-Cookie | `apps/api/src/app.ts:51-52`；`apps/api/src/middleware/auth.ts:30-61` |
| F06 | P1 | 播放器对所有错误无界重试，并不断改变媒体 URL | 持续故障时无限 Function/API 请求；重复鉴权与签名 | `apps/web/components/player.tsx:22-41,49-56,68-74` |
| F07 | P2 | analytics 2 秒小批提交容易产生低装载率请求，但并非空转轮询 | 详情页通常分开提交 view/read，各一次 BFF invocation；列表滚动产生多批 | `apps/web/lib/analytics.ts:39-41,82-107,144-148` |
| F08 | P1 | feed/正文/图集缺少稳定图片尺寸与响应式派生图；图集全部默认 eager | CLS、LCP、媒体带宽、首屏资源竞争 | `apps/web/components/feed-timeline.tsx:31-35`；`apps/web/app/p/[slug]/page.tsx:99-105` |
| F09 | P1 | feed/tags 排序表达式不匹配现有索引；列表查询读取不需要的完整正文 | API 延迟、DB 扫描/排序、DB→API 流量；sitemap 成倍放大 | `apps/api/src/routes/contents.ts:55-61,244-251`；`packages/db/src/schema.ts:84,95` |
| F10 | P1 | 详情全部动态；内容关联查询串行，合集付费成员逐项查询权益 | 服务端关键路径、TTFB/LCP；登录用户合集 N+1 | `apps/api/src/routes/contents.ts:95-128,193-224`；`packages/core/src/entitlements.ts:38-65` |
| F11 | P2 | 登录、注册、重置密码、兑换页面的静态壳被强制动态化 | 可避免的页面 Function invocations | 四个页面的 `page.tsx:6`；`apps/web/components/redeem-client.tsx:33-50` |

### 必须先纠正的三个判断

1. **`cache: "no-store"` 不等于 generateMetadata/page 不进行请求级去重。**  
   本仓库的 Next 15.5.27 去重实现明确不把 `cache` 纳入 key；不能直接把详情 API 成本算成两倍。详见 A.7。

2. **`force-dynamic` 不等于所有显式缓存 fetch 都失效。**  
   本版本中 `/c` 的显式 `next.revalidate: 60` 可以继续使用 Data Cache；问题是页面本身仍然动态执行。详见 A.1。

3. **免费媒体 302 已经有缓存头。**  
   不能写成“所有 302 均无缓存”。代码返回 `public, max-age=300`；真正未证实的是其在目标 Vercel 部署上的共享命中率，以及会话续期响应对缓存资格的影响。详见 A.4。

---

# A. 资源消耗

## A.1 缓存机制与现有拓扑

### A.1.1 本报告采用的缓存分层

| 层 | 保存什么 | 能减少什么 | 不能自动减少什么 |
|---|---|---|---|
| React 渲染期请求去重 | 同一次渲染中的相同 GET/HEAD 请求结果 | metadata/page 等重复发往 API 的请求 | 跨访问的 Function invocations |
| Next Data Cache | 显式缓存的 fetch 响应 | API 回源、API/DB 工作量 | 动态页面本身的 SSR invocation |
| Next Full Route Cache / ISR | HTML、RSC 等页面结果 | 命中时的页面渲染与 API 调用 | 浏览器实际发来的 CDN 请求次数 |
| 浏览器 HTTP 缓存 | JSON、302、媒体字节等 | 命中且不重新验证时的网络请求 | 其他用户的请求 |
| CDN 响应缓存 | 可共享的页面/JSON/重定向响应 | 命中时的源站 Function/API 工作 | CDN 自身的请求计数 |
| OSS 字节缓存 | 对象字节 | 对象回源与重复下载 | 初次解析 `/api/media/:id` 的 BFF 跳转 |

**关键计费边界：**

- SSR helper 直接请求 `API_INTERNAL_URL`，不经过本站 `/api/*` Route Handler：`apps/web/lib/api.ts:17-18,49-52`。  
  因此，“页面 SSR 调用了 5 次 Hono API”不是“额外产生 5 次 Vercel BFF invocation”。
- 浏览器请求 `/api/*` 才进入 BFF：`apps/web/app/api/[...path]/route.ts:17-55`。
- 减少 API 回源不代表减少 CDN 请求；提高 CDN 命中率主要减少源站执行。
- 媒体字节由 OSS 返回，不应全部计入 Vercel 媒体带宽。

### A.1.2 `no-store` 与请求去重：不是同一层

【已确认事实】

Next 实现：

- `apps/web/node_modules/next/dist/server/lib/dedupe-fetch.js:59-75`：去重 key 包含 method、headers 等，**不包含 `cache`**。
- 同文件 `:77-90`：使用 React `cache()` 保存渲染期条目；显式传入 `signal` 会退出此去重路径。
- 同文件 `:104-114`：主要针对 GET/HEAD，`keepalive` 请求不走该去重。
- `apps/web/node_modules/next/dist/server/lib/patch-fetch.js:898-904`：全局 patched fetch 包装了上述 dedupe fetch。

因此：

> `no-store` 关闭的是这里的持久化 fetch 缓存，而不是无条件关闭 React 渲染期 GET 去重。

这不意味着不同 HTTP 访问之间能够去重，也不意味着普通 Route Handler 中的任意请求都会获得 React 渲染树的 memoization。

### A.1.3 `/c` 的 `force-dynamic` 没有抵消显式 Data Cache

【已确认事实】

- `/c`：`apps/web/app/c/page.tsx:15-22`，页面强制动态，同时 fetch 显式传 `revalidate`。
- Next `patch-fetch.js:345-360`：只有缺少显式 fetch 配置等条件满足时，`forceDynamic` 才使该路径的 fetch 默认不缓存。这里正数 `currentFetchRevalidate` 不满足该条件。
- `patch-fetch.js:532-540`：正数 revalidate 进入可缓存路径。
- `create-component-tree.js:151-166`：`force-dynamic` 则明确阻止普通静态页面生成。

结论：

```text
/c 每次页面请求
  → 执行 Next SSR
  → publicFetch("/api/collections")
      → Data Cache HIT：不回源 API，但 SSR 已经执行
      → MISS/STALE：需要取数或刷新
```

现有 E2E 也按此行为设计：

`e2e/tests/collection-pages.spec.ts:34-45` 使用轮询等待动态页面内部的 Data Cache SWR 刷新。不过测试代码存在不等于本次测试已经执行通过。

### A.1.4 ISR 到期不是定时器，SWR 也不是必然再旧一个完整窗口

【已确认事实】

- Data Cache 在读取时比较 age 与 revalidate：  
  `apps/web/node_modules/next/dist/server/lib/incremental-cache/index.js:360-365`。
- 普通动态渲染遇到 stale fetch 时，可以先返回旧数据并后台刷新：  
  `patch-fetch.js:707-733`。
- 但当 `workStore.isRevalidate && entry.isStale` 时，会走前台等待新数据的分支：  
  `patch-fetch.js:708-711`。
- 路由响应缓存先 resolve 旧条目，再发起再生成：  
  `apps/web/node_modules/next/dist/server/response-cache/index.js:185-209`。

因此：

- `revalidate=60` 是**访问触发的到期刷新阈值**，不是每 60 秒无访问也自动调用 API 的轮询任务。
- 对正常 ISR，请求可能先拿到旧页面，但后台再生成不必然再读一整轮旧 fetch。
- `apps/web/app/sitemap.ts:5-9` 中“必然滞后一个缓存窗口、缓存本无收益”的解释过于绝对，不能据此否定 sitemap 缓存。
- 上游若另外部署 HTTP CDN，可能再形成独立陈旧窗口；当前 `deploy/Caddyfile:2-8` 只有代理与压缩，没有配置此类缓存。

### A.1.5 逐路由清单与建议

`R = FEED_REVALIDATE_SEC`，默认 60 秒。

| 路由 | 当前代码事实 | 当前主要缓存层 | 建议 |
|---|---|---|---|
| `/` | `app/page.tsx:8-12`，fetch `revalidate=R`，不读身份 | Data Cache + 可静态生成的页面结果 | 改 `feed` tag + 长 TTL，例如 24h；发布后失效 |
| `/tags/[slug]` | `app/tags/[slug]/page.tsx:9-17`；route revalidate 写死 60，fetch 用 R；无 `generateStaticParams` | Data Cache；不能仅凭 revalidate 认定 Full Route ISR | 增加返回 `[]` 的 `generateStaticParams`，按需静态生成；`tag:<slug>` 失效；统一长 TTL |
| `/c` | `app/c/page.tsx:15-25`，force-dynamic + fetch R | 动态 SSR + Data Cache | 去掉 force-dynamic；`collections` tag + 长 TTL；失败不要写入空列表 |
| `/p/[slug]` | `app/p/[slug]/page.tsx:16-25`；`lib/api.ts:40-52` | 请求级去重；无跨请求私有数据缓存 | 公开 DTO/预览壳 ISR，权益全文按需动态；不可缓存现有混合响应 |
| `/c/[slug]` | `app/c/[slug]/page.tsx:12-21` | 动态 SSR + 私有 no-store | 公开成员元信息静态化，解锁标记按用户批量动态获取 |
| `/sitemap.xml` | `app/sitemap.ts:11-14,25,39-40` | 无业务数据缓存，每次全量遍历 | 独立轻量数据源 + 缓存/静态快照；业务变更更新；长 TTL |
| `/robots.txt` | `app/robots.ts:3-8`，只读环境变量 | 可静态生成 | 保持；部署时校验 SITE_URL |
| `/about` | `app/about/page.tsx:6-22`，本地 site config | 可静态生成 | 保持静态，配置变更随部署更新 |
| `/login`、`/register`、`/reset-password` | 各 `page.tsx:6` force-dynamic，但页面只是表单壳 | 不必要的动态 SSR | 移除 force-dynamic；认证 POST 继续私有 |
| `/redeem` | `app/redeem/page.tsx:6-20`，身份读取位于客户端 | 动态壳 + 客户端私有请求 | 壳静态化；个人数据继续 no-store |
| 浏览器 `/api/feed`、`/api/tags/:slug`、`/api/collections` | BFF `route.ts:49-55,102`；API `contents.ts:74,177,262` | BFF 不缓存 upstream fetch；HTTP 响应有 public max-age=60 | 独立无身份公开入口；分页使用可明确失效的 CDN 数据设计 |
| `/api/contents/:slug`、`/api/collections/:slug` | API `contents.ts:147,226` private no-store | 私有请求 | 保留现有私有入口；另加纯公开 DTO，不直接修改现有响应为 public |
| `/api/media/:id` | API `media.ts:31-38` | 免费 302 max-age=300；付费 no-store | 免费/付费入口职责分离；优化免费派生图路径，签名仍短期 |
| `/api/analytics/events` | POST；BFF 动态中转 | 不可响应缓存 | 事件聚合、去掉无用认证，可选绕过 Vercel 的独立采集入口 |
| `/api/auth/*`、`/api/redemptions`、`/api/me/*` | 私有身份/变更接口 | 不应共享缓存 | 继续私有；不要为节流引入跨用户缓存 |

**标签页为何需要单独指出？**

`apps/web/app/tags/[slug]/page.tsx:1-48` 没有静态参数生成，也没有 `force-static`：

- Next `dist/build/static-paths/app.js:515-540,629-637`：这种动态段不能产生相应的 prerenderedRoutes。
- Next `dist/build/index.js:1239-1275`：无静态参数的动态页面，只有满足另外的静态化条件才进入相应分支。

本地 `.next/prerender-manifest.json` 也未列出标签动态路由，但该目录可能来自旧构建/测试，本报告不把它当作生产部署证明。

---

## A.2 F01／F02：短周期缓存与缺失的业务失效链路

### 事实与影响

【已确认事实】

- 首页、合集列表、标签取数默认 R=60：  
  `apps/web/app/page.tsx:8-12`、`app/c/page.tsx:17-22`、`app/tags/[slug]/page.tsx:9-17`。
- 标签页面路由的 revalidate 另写死 60，单独调大环境变量并不能完成整个策略迁移。
- API 三个公开列表响应也写死 `max-age=60`：  
  `apps/api/src/routes/contents.ts:74,177,262`。
- `publicFetch` 不接受 `tags`：`apps/web/lib/api.ts:33-37`。
- 对 `apps`、`packages` 的调用搜索未发现 `revalidateTag`、`revalidatePath` 或业务 webhook 实现。
- 发布、下架、删除、合集更新直接操作 DB：  
  `apps/cli/src/commands/content.ts:33-60,94-106`；  
  `apps/cli/src/commands/collection.ts:18-23,48-76`；  
  `packages/core/src/publish.ts:208-320`。

【推断／量化模型】

对持续有人访问的一个缓存键，60 秒阈值对应约 **1,440 个到期刷新机会/日**；这是量级模型，不是后台固定产生 1,440 次请求的事实。

改成业务失效 + 24h 兜底后，刷新频次可以接近：

```text
实际业务失效次数 + 被访问触发的长 TTL 兜底刷新次数
```

而不是主要随访问时间流逝增长。

实际 ISR 写入计费还受缓存对象大小、再生成次数、部署与平台计量方式影响，不能将一次刷新直接等同于一个固定计费单位。`/c` 即使 Data Cache 命中，每次访问仍有 SSR 成本。

### 建议修复

1. **修改 `apps/web/lib/api.ts`**：公开 fetch 接受稳定 tags 与长 TTL；例如 `feed`、`collections`、`tag:<slug>`。
2. **修改首页、标签页、合集列表页**：
   - 默认兜底改为 24h 等长周期，而非 60s。
   - `/c` 去掉 `force-dynamic`。
   - 标签页增加按需静态生成能力。
3. **新增独立的服务端失效 Route Handler**，例如 `app/api/revalidate/route.ts`：
   - 不经过当前泛用 BFF 白名单代理。
   - 独立服务端签名/HMAC、时间戳、事件 ID、重放防护。
   - 不把任何失效密钥暴露给浏览器。
   - 按已验证事件调用本版本支持的 `revalidateTag(tag)`、必要的 `revalidatePath(path)`。
4. **事务提交后发送失效事件**：
   - 内容发布、更新、下架、删除：feed、内容路径、旧/新标签、旧/新合集、sitemap。
   - 合集更新、排序：合集列表、合集详情、相关内容所属合集信息、sitemap。
   - 曝光或封面变化：同时处理媒体公开缓存。
5. **防止数据库提交成功、失效通知丢失**：
   - 最小方案：CLI 明确报告失效失败并支持事件重放。
   - 更可靠方案：事务 outbox + 提交后投递与有界重试。
   - 不要在 webhook 失败后假装 DB 发布事务也回滚了。
6. **处理失败缓存**：
   - 首页 `app/page.tsx:10-17` 把所有错误降级成空数据。
   - 若长 TTL 后继续这样做，临时 API 故障可能被再生成成长期空页。
   - 区分“成功返回零条”和“取数失败”；后者应保留上次成功结果，或让生成失败，而不是写入空态。

**P2 附带问题：**API 的 `stale-while-revalidate` 没有给秒数，见 `contents.ts:74,177,262`。不要依赖这种写法获得确定的 HTTP SWR 行为；若保留该指令，应指定窗口。它与 Next 的 `next.revalidate` 不是一回事。

---

## A.3 F03：sitemap 的调用放大

### 已确认事实

`apps/web/app/sitemap.ts`：

- `:11` 强制动态。
- `:14` 最多 1,000 页。
- `:25` 先请求合集列表。
- `:39-40` 顺序请求 feed 游标页，每次 no-store。
- `:46-53` 只使用内容 slug、publishedAt。
- `:41-44,61-68` 失败或超上限时记录日志，仍返回部分结果。

`apps/api/src/routes/contents.ts:53-88`：

- feed 每页 20 条。
- 每个非空页通常执行一条内容查询、一条标签批量查询。
- sitemap 不需要的标题、描述、封面和 tags 仍被查询、传输。

### 放大规模

令已发布内容数为 N。N>0 且遍历正常完成时：

```text
每次 sitemap HTTP 请求
  ≈ 1 次 Vercel Function 执行
  + [1 次合集 API + min(ceil(N/20), 1000) 次 feed API]
```

| 内容规模 | API 请求数/次 sitemap | 非空 feed 页 SQL 数 |
|---:|---:|---:|
| 1,000 | 51 | 约 100 |
| 10,000 | 501 | 约 1,000 |
| 20,000 | 1,001 | 约 2,000 |
| 超过 20,000 | 仍最多 1,001 | 老内容可能被截断 |

还需加合集列表的一至两条查询。

【推断】若单页 API 往返平均 50ms，500 页仅顺序往返就约 25 秒，尚未计入 SQL 排序、传输、生成 XML 等。实际需采样，不能用此示例宣称生产已经超时。

**这里不是 1,001 次 Vercel invocation，而是一段很长的 Vercel 执行加 1,001 次后端调用。**

### 建议修复

**优先方案：业务变更生成/更新 sitemap 快照。**

- 在 `apps/api/src/routes/contents.ts` 或单独 sitemap 路由中新增轻量查询：
  - 仅选 `slug`、`updatedAt` 等 sitemap 字段。
  - 内容过滤 `status=published`。
  - 不拉正文、标签、封面和权益。
- 在 `apps/web/app/sitemap.ts` 使用缓存快照，不在爬虫请求路径中遍历 feed。
- 发布事件使 sitemap tag/path 失效；长 TTL 只做兜底。
- 数据量增大时拆分 sitemap index 与分片，避免单文件无限增长。
- 快照生成失败保留上次完整结果；不要以成功响应覆盖成半份 sitemap。
- `lastModified` 应来自内容真实更新时间，而不是只使用 `publishedAt`：目前见 `sitemap.ts:49`；更新正文但保留发布时间时，后者不会反映更新。

**最小过渡方案：**先改成轻量专用 API + 长 TTL/on-demand 缓存。即使暂不做完整离线快照，也能立即消除爬虫每次请求的 O(N/20) feed 调用。

已有测试只证明 25 篇以上能收录：

`e2e/tests/feed-pagination.spec.ts:130-141`。它不覆盖 1 万条规模、请求数上限、失败保留旧结果或 Vercel 超时。

---

## A.4 F04：媒体 302、CDN 命中与封面放大

### A.4.1 实际链路

```text
浏览器 <img src="/api/media/<id>">
  → Vercel CDN / BFF Function
  → Hono 媒体查询与访问控制
  → 302 Location: 短期签名 URL
  → 浏览器直接请求 OSS 字节
```

证据：

- feed 封面入口：`apps/web/components/feed-timeline.tsx:31-35`。
- BFF upstream `redirect:"manual"`、`cache:"no-store"`：  
  `apps/web/app/api/[...path]/route.ts:49-55`。
- BFF 原样透传 302：同文件 `:89-92`。
- 媒体查询、鉴权、签名：`apps/api/src/routes/media.ts:18-39`。
- OSS 签名为本地 SDK `signatureUrl` 调用：  
  `packages/core/src/storage/oss.ts:71-73`，不是每次都发一个 OSS“签名 API”网络请求。

### A.4.2 是否每张图片都产生 invocation？

**不是无条件每次都会。**

- 浏览器命中有效的 302 缓存，可以不再访问 Vercel。
- 如果 Vercel CDN 实际命中共享 302，也可以不执行 Function。
- **未命中这些缓存的 `/api/media/:id` 请求会执行 BFF，并调用 Hono。**
- 图片字节随后由 OSS 直出，不经过 BFF。

【已确认事实】

免费规则响应：

```http
Cache-Control: public, max-age=300
```

付费权益规则响应：

```http
Cache-Control: private, no-store
```

见 `apps/api/src/routes/media.ts:31-38`，常量见 `packages/config/src/constants.ts:22-27`。

BFF 会复制 Cache-Control，见 `route.ts:60-64`。本版本 Next 动态 Route Handler 也直接发送响应，见：

`apps/web/node_modules/next/dist/build/templates/app-route.js:287-293`。

因此不能认为 `force-dynamic` 必然把应用给出的 HTTP 缓存头清掉。

**但是：**源码没有显式区分 Vercel 共享缓存 TTL 与浏览器 TTL，也没有生产 `x-vercel-cache`、Age 或 Function 日志证明。`public,max-age=300` 至少表达了 HTTP 缓存意图，不能仅凭它声称已经实现预期的 Vercel CDN 成本节省。

### A.4.3 成本模型

一页有 K 张封面实际进入加载范围：

```text
媒体解析的额外 Vercel CDN 请求
  ≈ K × 浏览器 302 缓存未命中比例

媒体解析的额外 Function 执行
  ≈ 上式 × Vercel CDN 未命中比例
```

首次访问、20 张封面最终全部加载、两层缓存均未命中时，可达 **20 次 BFF + 20 次 API 请求**。

但 feed 有 `loading="lazy"`，不能把这 20 次全部算成首屏立即发生。

此外：

- OSS 对象上传写入 `private,max-age=604800`：  
  `packages/core/src/storage/oss.ts:45-52`。
- 新生成的签名 URL 查询参数可能变化，浏览器不能把不同 URL 当然视为同一个缓存对象。
- 所以“字节缓存 7 天”并不能保证同一媒体跨多次重新签名只下载一次。

### 建议修复

1. **先在生产验证缓存，不凭头名称推断命中率。**
   - 同一媒体连续匿名请求、另一浏览器请求、登录且续期请求分别测量。
   - 记录状态、Location、Age、`x-vercel-cache`、Set-Cookie、对应 BFF/API 日志。
2. **为免费媒体设置明确的共享缓存策略。**
   - 可在免费分支按目标平台采用明确的 `s-maxage` 或平台专用 CDN 缓存头。
   - 付费分支继续 private/no-store。
   - 共享 TTL + 可陈旧服务窗口必须小于签名实际剩余寿命，并留安全余量。
   - 当前 300 秒和默认 900 秒不能简单一起替换为 24 小时。
3. **优先优化封面，而不是所有受保护媒体。**
   - 从内容模型上明确公开的封面/缩略图可走独立派生图域名或可撤销的图片 CDN。
   - 如果这些素材未来仍要求“免费转付费后停止新访问”，就不能贸然改为永久公共对象 URL。
   - 可继续使用短期签名，但将免费解析迁往媒体服务/CDN，避免每次穿越 Vercel。
4. **业务变更联动失效媒体缓存。**
   - 封面变更、内容下架、exposure 翻转，通知实际拥有媒体 CDN 缓存的服务。
   - `revalidateTag` 不会自动清除任意外部 CDN 或已进浏览器的 302。

现有架构已明确签名 URL 的撤销边界：

`docs/architecture.md:277-281`。优化不能承诺追回已经交付的字节，也不能为了节省请求破坏原有付费隔离。

---

## A.5 F05：认证中间件放大了公开请求和埋点的 DB 工作

### 已确认事实

- 所有 API 请求均经过 auth middleware：`apps/api/src/app.ts:51-52`。
- BFF 所有白名单路径都尝试把 session Cookie 转换为 Bearer：  
  `apps/web/app/api/[...path]/route.ts:35-38`。
- 有效登录请求：
  - 会话联查用户：`apps/api/src/middleware/auth.ts:35-40`。
  - 每次都更新 `sessions`：同文件 `:48-55`。
  - 到续期条件时返回 `x-session-expires`：`:58-61`。
- BFF 续期时写 Set-Cookie：`route.ts:83-87`。
- analytics 业务处理不需要登录用户：  
  `apps/api/src/routes/analytics.ts:45-126`。

### 影响

登录用户的以下请求，即使业务响应与身份无关，也可能额外触发认证 SELECT + UPDATE：

- 加载更多 feed/tags。
- `/api/collections`。
- analytics 批量提交。
- 免费封面的媒体解析。

例如 20 张未缓存封面 + 2 批详情埋点，若这些请求均到达 API，认证逻辑本身就可能增加 **22 次会话查询 + 22 次会话写入**。

【推断】这会增加 WAL、索引/行更新和同一 session 热点竞争；程度取决于访问量与并发。续期 Set-Cookie 还会影响共享缓存资格，需生产验证。

### 建议修复

- 在 BFF 对明确匿名的 feed/tags/合集列表/analytics **不转发 session**。
- 在 API 中对这些路由跳过认证，而不只是 handler 内“不调用 `c.get("auth")`”。
- 媒体先判定身份无关的免费规则，只有未命中免费规则时才做私有鉴权；避免为封面提前读取会话。
- 对仍需认证的私有请求：
  - 保留用户禁用与权益撤销的实时安全语义。
  - 单独评估是否必须每个请求都写 `lastUsedAt`。
  - 可仅在滑动续期时写，或采用有条件的低频更新时间戳；这不需要引入客户端轮询。
- 增加测试：登录态访问匿名接口不产生 session 更新，也不携带 Set-Cookie。

---

## A.6 F06／F07：播放器重试与 analytics 请求频率

### A.6.1 F06：播放器存在真实的无界请求循环

【已确认事实】

`apps/web/components/player.tsx:26-29` 对任何 `error`：

```text
retry += 1
```

随后：

- `:39-40` 把媒体 URL 改成 `?r=<retry>`。
- `:49-54`、`:68-73` 使用变化的 key 重建媒体元素。
- 新元素再次失败，再走同一逻辑。
- 无最大次数、退避、停止状态或错误分类。

**影响：P1。**源对象持续 403/404、用户权益已失效、媒体格式不可播放或服务持续异常时，会不断产生新的 BFF/API 请求；query 变化还降低缓存复用。

### 最小修复

修改 `components/player.tsx`：

- 自动刷新签名最多一次或很少次数。
- 持续失败停止自动重建，展示用户触发的重试入口。
- 对明确不可恢复的权限/资源不存在状态停止重试；如需识别 HTTP 状态，可增加一次受控解析流程，而不是每次错误无限取新地址。
- 网络错误使用有界退避；组件卸载取消。
- 成功恢复后再清理重试状态，并防止连续 error 事件并发触发。

已有媒体测试主要模拟“一次失败后恢复”：

`e2e/tests/media.spec.ts:249-279`。应补永久 403、永久网络错误、无效媒体格式的请求数量上限断言。

### A.6.2 F07：analytics 不是每 2 秒空转请求

【已确认事实】

`apps/web/lib/analytics.ts`：

- `:39-41`：2 秒窗口、每批最多 20、最多重入队一次。
- `:71-86`：有事件才入队并调度；click 立即 beacon。
- `:96-107`：`setTimeout` 而非持续 `setInterval`；空队列直接返回。
- `:144-148`：pagehide/hidden 调用 flush，但空队列仍不发请求。

`apps/web/components/analytics.tsx`：

- `:68-80`：曝光 1 秒确认计时。
- `:140-172`：详情 mount 产生 view，前台累计 10 秒产生 read；500ms interval 只检查本地停留时间。

因此：

- 500ms 检查不是网络轮询。
- pagehide 与 hidden 两个监听不意味着每次必然发两包。
- 也不是每张卡片一条独立 POST；同一窗口可以批量提交。

### 当前成本

**P2。**详情页正常停留足够长时：

- view 通常在约 2 秒提交。
- read 通常在达标后再等约 2 秒提交。
- 即一篇详情常见 **2 次 analytics BFF invocation**，不包括列表 click/impression。

若有 10 万次符合该行为的详情访问，埋点路径约为 20 万次 invocation；这是条件模型，不是生产流量测量。

API 已经批量验证目标、批量 insert 并按 eventId 去重：

`apps/api/src/routes/analytics.ts:89-123`。不应误报为每个 analytics 事件逐条 N+1 插入。

### 建议修复

1. 优先去掉 A.5 的无用认证。
2. 保持 eventId 幂等，但提高每包装载率：
   - 队列满按事件触发。
   - view 可与 read 合并；短访问在离开时提交。
   - click 不必在所有站内软导航上立即发空载率很高的单包，但需保留真实离站可靠性。
   - 如业务需要实时性，采用有队列时的较长兜底窗口，而非两秒窗口。
3. 增大等待窗口时同步处理：
   - pagehide 超过 20 条的分包与字节预算。
   - keepalive/beacon 限制、失败有界重试、队列内存上限。
4. 若 invocation 是主要账单项，评估浏览器直达独立采集域名：
   - 由 Hono/Caddy 提供专用匿名 ingest。
   - 正确配置 Origin、CORS、限流与可信客户端 IP。
   - 不把 BFF secret 交给浏览器。
   - 跨域 `application/json` 可能有预检，需要一并测量，而不是只统计 POST。

---

## A.7 generateMetadata 与 page：逐路由核对

| 路由 | 调用点 | HTTP 请求级结论 |
|---|---|---|
| `/p/[slug]` | `app/p/[slug]/page.tsx:29-31,45-47` 均调用 getContent；`:22-25` 调同一 apiFetch | 同一次渲染、相同请求头、无显式 signal，具备 GET 去重条件；不能确认两次 API 回源 |
| `/c/[slug]` | `app/c/[slug]/page.tsx:25-27,32-34` 均调用 getCollection | 同上 |
| `/tags/[slug]` | `app/tags/[slug]/page.tsx:23-25,30-32` 均调用 getTag | 同一 GET，且另有 Data Cache |
| 首页、`/c`、静态表单页等 | 静态 metadata 或不重复取业务 API | 未发现 metadata/page 两份相同业务 API 请求 |

**结论：未发现能够仅由当前代码确认的 metadata/page 双倍 HTTP 回源问题。**

仍有一个较小优化机会：

- `getContent`、`getCollection`、`getTag` 自身没有 React `cache()`。
- 即使 fetch 去重，调用方仍各自处理 Response、解析 JSON。
- 可以用模块级 React `cache(async (slug) => ...)` 明确共享**单次请求内**的已解析对象。
- 不要把含用户权益的对象改成跨请求全局 Map、`unstable_cache` 或公开 Data Cache。

【待验证】通过 API requestId/日志确认一次实际页面请求产生几次内容 API 调用，注意分开浏览器导航、RSC 请求、预取、开发模式重放等来源。

---

# B. 加载速度

## B.1 F08：图片是最直接的 Lighthouse 风险

### B.1.1 feed 封面没有稳定占位

【已确认事实】

`apps/web/components/feed-timeline.tsx:31-35`：

- 裸 `<img>`。
- 没有 width/height。
- 没有固定 aspect-ratio。
- `max-h-64` 只限制最大高度，并不等于在图片加载前预留相同高度。
- 全部 `loading="lazy"`。
- 没有 srcset/sizes 或尺寸参数。

**影响：P1。**

- 图片解码后才能确定固有比例，可能推动后续条目产生 CLS。
- 如果首张封面是实际 LCP 元素，lazy loading 可能延迟其发现/加载。
- 原图可能远大于实际展示所需尺寸。

【推断】实际 CLS、LCP 退化幅度取决于图片比例、网络、缓存、视口以及哪个元素成为 LCP，必须测量。

### B.1.2 正文和图集同样有尺寸问题；图集还有 eager 放大

- 正文图片：`apps/web/components/markdown.tsx:40-42`，lazy，但没有从媒体元数据补尺寸。
- 图集图片：`apps/web/app/p/[slug]/page.tsx:99-105`：
  - 无 width/height。
  - 无 loading，默认 eager。
  - 所有 galleryMedia 都渲染。
- 轮播用 overflow 隐藏非当前页：`apps/web/components/ui/carousel.tsx:48-52`；视觉不可见不等于未发起图片请求。
- API 已返回媒体 width/height：`apps/api/src/routes/contents.ts:109-117`，页面未使用。
- 但发布流程当前只写 key、mime、size：`packages/core/src/publish.ts:211-215`，没有自动探测尺寸。
- schema 的 width/height 只是可空字段：`packages/db/src/schema.ts:109-110`。

**不能只改 JSX 使用 `m.width` 就认为问题已解决；发布链路需要实际填充。**

### B.1.3 当前媒体服务没有实现缩放合同

证据：

- API 签名只传 key 和 TTL：`apps/api/src/routes/media.ts:31`。
- Storage interface：`packages/core/src/storage/interface.ts:24-25`，只有 `signGetUrl(key, ttlSec)`。
- OSS：`packages/core/src/storage/oss.ts:71-73`，未传图片处理参数。
- fs 模式读取原对象：`packages/core/src/storage/fs.ts:89-94`。

所以给 `<img>` 随意附加 `?w=640` 目前不会实现缩放。

### 建议修复

1. **立即降低 CLS：**
   - feed 选择稳定的展示比例，如 16:9，容器明确占位；或返回真实尺寸并设置 width/height。
   - 图集和正文使用可获得的媒体尺寸。
   - 音频封面已有 `h-16 w-16`，`media-player.tsx:38`，不应与无占位图片一概而论。
2. **发布时探测并保存尺寸**：
   - 修改 `packages/core/src/publish.ts`。
   - 对旧素材补全元数据。
   - 对正文图片建立 mediaId→尺寸映射，供服务端渲染。
3. **公开封面生成响应式派生图**：
   - 发布时生成固定宽度档位，或者扩展 storage 的受控图片处理签名。
   - 白名单宽度、质量、格式，限制任意变体数量。
   - feed 返回派生图信息，前端用 srcset/sizes。
4. **首屏区别对待：**
   - 仅对已确定的首屏关键图使用 eager/fetchPriority，不能把 20 张都设高优先级。
   - 后续图片继续 lazy。
   - 图集只优先加载当前/邻近项。
5. **是否采用 next/image：**
   - 它不是唯一解；OSS 派生图 + 普通响应式 `<img>` 同样可以解决尺寸和传输问题。
   - 若采用 Next Image，应核对图片鉴权、签名过期、缓存撤销以及新增优化/带宽费用。
   - 不要将需要浏览器 Cookie 的私有 `/api/media/:id` 直接套入公共图片优化缓存。

---

## B.2 F09：分页网络与 DB 排序

### B.2.1 前端分页已经是游标分页，但仍走双跳

【已确认事实】

`apps/web/components/load-more.tsx:15-24`：

- 用户点击后请求同源 `/api/feed?cursor=...` 或 `/api/tags/:slug?cursor=...`。
- BFF `route.ts:49-55,102` 再 no-store 请求 Hono。
- 每次**未命中浏览器/CDN**的分页请求，链路为一个 Vercel Function + 一个 API 请求。

API 游标优点：

- `contents.ts:34-38` 使用 keyset，而非 OFFSET。
- `:55-61` 按排序键和 id 全序排序，多取一条判断结束。
- `:90` 仅在确实有下一页时返回 cursor。
- tags 采用同一合同：`:244-282`。
- 批量查询 tags，不是每条内容查一次：`:64-71,253-260`。

现有分页正确性测试覆盖毫秒碰撞、微秒数据、重复/遗漏、标签加载更多：

`e2e/tests/feed-pagination.spec.ts:14-17,56-128`。这些是应保留的优点。

### B.2.2 排序表达式不匹配现有索引

【已确认事实】

查询排序：

```text
date_trunc('milliseconds', coalesce(published_at, created_at)) DESC,
id DESC
```

见 `apps/api/src/routes/contents.ts:55-60,244-250`。

现有索引：

```text
(status, published_at)
```

见 `packages/db/src/schema.ts:95`、`packages/db/drizzle/0000_long_lockjaw.sql:163`。

缺少与实际表达式和 id 对齐的索引。现有索引可以协助部分过滤，但不能因为存在 published_at 索引，就认定这个排序能直接用有序索引扫描完成。

【推断】数据增大后可能出现大量候选扫描、额外 Sort/Top-N，深页和 sitemap 全量遍历尤其受影响。需要 EXPLAIN 验证实际计划。

### B.2.3 列表查询读取了完整正文

- feed `.select()`：`contents.ts:57`。
- tags `.select({ content: contents })`：`:246`。
- schema 包含 `bodyMarkdown`：`schema.ts:84`。
- 最终列表 JSON 并没有正文：`contents.ts:75-88,263-279`。

**影响：DB→API 传输、内存与反序列化，不是直接把正文发给浏览器。**

例如每篇正文平均 50KB，一页读取 21 条就可能把约 1MB 不需要的正文带到 API；这只是条件估算。sitemap 复用该接口会重复放大此成本。

### 建议修复

**最小且低风险：**

1. feed/tags 显式投影列表所需字段，排除 bodyMarkdown 等。
2. 给真实排序建立匹配的数据模型和索引。
   - 不要直接删 `date_trunc`，已有微秒兼容测试说明它承担正确性职责。
   - 可以持久化统一的毫秒排序键，并在发布/导入时维护，再建 `(sortKey, id)` 的 published 部分索引。
   - 或在保证所有写入路径都遵守相同精度/非空规则后，统一 publishedAt 排序与索引。
   - **不要直接复制当前 timestamptz 的 date_trunc 表达式建索引而不检查 PostgreSQL immutability 限制。**
3. tags 联表计划要单独测：
   - 已有 `content_tags(tag_id)` 索引：`schema.ts:180`。
   - 先确认瓶颈是否需要 `(tag_id,content_id)` 覆盖索引；不要在没有计划证据时盲目堆索引。
4. 对浅页、深页、热门标签分别做 `EXPLAIN (ANALYZE, BUFFERS)`，记录 rows scanned、sort、buffers 与耗时。

### CDN 分页建议及陷阱

可以做公开 CDN 分页，但必须处理“如何失效”，不能只加一年 TTL：

- **短期最小方案：**拆出不读身份的公开代理，明确 CDN 缓存策略和实际 CDN purge；用 Data Cache 只能减少 API 工作，仍不能消除动态代理 invocation。
- **更稳的长期方案：**业务变更产生版本化的公开分页 JSON/快照；首页携带 revision，后续页按同 revision 读取对象 CDN。
  - 真正不可变的版本 URL 才适合长缓存。
  - 下架/权限收紧需要清理旧版本可访问性，不能把私有正文包含在分页快照中。
- `revalidateTag` 不自动清理任意手写 `s-maxage` 响应所在的外部 CDN，也不能召回浏览器缓存。
- 不要把使用 query cursor 的 handler 简单改成 `force-static`，却忽略 URL query 与缓存键/静态生成行为，造成所有游标拿同一页。

---

## B.3 F10：详情 SSR 与 API 瀑布

### B.3.1 首屏关键路径

**首页缓存未命中时：**

```text
Next getFeed
  → API feed 内容查询
  → tags 批量查询
  → JSON
  → 页面主体渲染
```

证据：`apps/web/app/page.tsx:21-24`、`apps/api/src/routes/contents.ts:56-71`。

页面自身只有一次业务 API 请求，没有发现首页同时串行调用多个不同业务 API 的瀑布。主要问题是 API 内部串行查询，以及图片后续的 302 链路。

**内容详情：**

```text
Next apiFetch
  → [登录态认证 SELECT + session UPDATE]
  → 内容 SELECT
  → [付费普通用户权益 SELECT]
  → tags SELECT
  → media SELECT
  → collections SELECT
  → [预览 Markdown 截断]
  → Next Markdown 渲染
```

证据：

- 页面先 await 内容再返回主体：`apps/web/app/p/[slug]/page.tsx:45-52`。
- API：`apps/api/src/routes/contents.ts:95-139`。
- auth：`apps/api/src/middleware/auth.ts:35-55`。
- 权益快捷路径：`packages/core/src/entitlements.ts:38-41`。

根 layout 可以先输出壳，Next 也可能流式处理部分工作；不能把所有耗时机械相加就声称等于浏览器 TTFB。但这些 await 确实阻塞正文完成和关键内容出现。

### B.3.2 合集存在条件明确的 N+1

`apps/api/src/routes/contents.ts:211-224` 在 for 循环中逐条 await `canAccess`。

只有当：

- 内容为 paid，
- 用户已登录，
- 且不是 admin，

`packages/core/src/entitlements.ts:38-65` 才实际查询权益。

因此，一个含 100 篇付费成员的合集，被普通登录用户访问时，即使用户持有全站订阅，仍可能执行 **100 次串行权益 SELECT**。

匿名用户、管理员、公开内容没有这个额外查询；不能无条件说所有合集请求都是 N+1。

另外，合集成员查询也读取完整 contents：

`contents.ts:199-204`，最终仅返回元信息与 access，没有正文：`:213-223`。

### 建议修复：先小改，再拆缓存

**第一阶段：不改变权限合同。**

- 内容关联的 tags/media/collections 查询在 contentId 已知后可并行。
- 预览结果可以在发布期预计算，避免每次匿名访问重复做同样的 Markdown 截断。
- 合集权益批量查询：
  - 先读取有效订阅/权益集合。
  - 批量得到成员与合集归属。
  - 内存集合判断或 SQL 批量 EXISTS，避免逐成员 round trip。
- 合集查询只选需要的字段。
- 不要只将 100 次串行改成 `Promise.all(100个 canAccess)`：
  - 会保留 100 次 SQL。
  - 连接池仅 10：`packages/db/src/client.ts:14-15`。
  - 容易从单请求慢变成并发挤占。

**第二阶段：公开壳 ISR + 私有权益。**

修改：

- `apps/api/src/routes/contents.ts`：
  - 新增身份无关的公开 content/collection DTO。
  - paid 内容只返回已裁剪预览、公共元信息和允许公开的媒体引用。
  - 现有私有全文入口保持 private/no-store。
- `apps/web/app/p/[slug]/page.tsx`：
  - metadata 和公共内容读取公开 DTO。
  - 长 TTL + content tag，配置按需静态生成。
  - paid 全文通过客户端私有请求获取；无登录/明确无权限场景可不做不必要请求。
- `apps/web/app/c/[slug]/page.tsx`：
  - 成员元信息静态化。
  - 解锁状态客户端一次批量获取。

**安全与体验边界：**

- 只移除 `force-dynamic`、继续使用原 `apiFetch`，不构成安全的静态化。
- 普通 `<Suspense>` 包一个动态权益组件，也不等于本项目自动启用了 PPR；`next.config.ts:2-5` 没有相应配置。
- 公开变付费、下架、预览缩短时，需要及时失效旧公开缓存。
- 私有全文不要进入 RSC 公共快照、共享 JSON 或跨用户缓存。
- 客户端解锁可能增加付费正文出现时间，需与首屏 TTFB 改善一起测量；预留容器，避免解锁后明显 CLS。
- 权益撤销/到期必须由 API 继续执行，不能只相信客户端“已解锁”状态。

---

## B.4 客户端 JS、重依赖与 CSS

### B.4.1 `'use client'` 清单

| 模块 | 用途与范围 |
|---|---|
| `components/analytics.tsx:11`、`lib/analytics.ts:10` | 首页/合集列表跟踪、详情跟踪；包含队列与计时逻辑 |
| `components/load-more.tsx:1` | 首页/标签分页；静态 import FeedTimeline，后者也进入这条客户端依赖图 |
| `components/theme-toggle.tsx:1` | SiteHeader 引入，几乎各页面都有 |
| `components/ui/dropdown-menu.tsx:1` | 主题菜单的 Radix 客户端依赖 |
| `components/media-player.tsx:1` | 播放器 dynamic 边界 |
| `components/player.tsx:1` | Video.js 音视频实现 |
| `components/ui/carousel.tsx:1` | 图集 Embla |
| `components/login-form.tsx:1` | 登录页 |
| `components/register-form.tsx:1` | 注册页 |
| `components/reset-password-form.tsx:1` | 密码重置页 |
| `components/redeem-client.tsx:1` | 兑换及权益界面 |
| `app/error.tsx:1` | 交互重试错误边界 |

### B.4.2 重依赖逐项结论

#### `@videojs/react`

【已确认事实】

- `media-player.tsx:8-16` 通过 `next/dynamic` 引入，`ssr:false`。
- 首页 feed 没有导入该播放器。
- `player.tsx:10-13` 同一模块同时静态导入 audio、video 实现及两份 skin CSS。

**正确之处：**已有首页隔离，不应写成“Video.js 确定进入首页首屏 bundle”。

**优化空间：**

- dynamic 是代码分块，不是“滚动到附近/点击播放才加载”。
- 当前视频/音频组件一旦被渲染就会尝试加载；正文底部播放器也没有独立的可见性边界。
- 音频、视频同一模块可能增加单一媒体类型的依赖加载，实际 tree-shaking/chunk 需构建分析。

建议先测，再按收益拆 audio/video 文件；对长正文媒体增加可见性或点击加载。已有 `preload="metadata"`，不要误报为代码显式要求整段视频预下载。

#### `embla-carousel-react`

- 直接静态导入：`components/ui/carousel.tsx:4`。
- 详情 page 顶层 import 轮播：`app/p/[slug]/page.tsx:11`。
- 只有 image 分支实际渲染：`:98-115`。

确认没有独立 dynamic 图集边界，但不能仅根据顶层服务端 import 就给出“所有文章访问必然下载多少 Embla 字节”的结论。建议在实际图集组件处建立独立边界，单图场景直接渲染图片，不必启动轮播。

#### `react-markdown`

- `components/markdown.tsx:7-12` 为服务端可用模块，没有 `'use client'`。
- 由服务端详情页使用：`app/p/[slug]/page.tsx:9,121-124`。
- 子组件中的客户端播放器边界不会反向把整个 Markdown 渲染器变成客户端模块。

**未发现 react-markdown 被首页或普通详情客户端边界直接拖入浏览器 bundle 的证据。**它的主要已知工作在服务端 Markdown 渲染，而不是可以直接认定的浏览器 TBT。

### B.4.3 字体和 CSS

【已确认事实】

- `apps/web/app/globals.css:1-2` 引入 Tailwind 和 typography。
- `:36` 定义 CJK 系统字体栈，`:44-48` 应用。
- 未发现 next/font 或远程字体下载配置。
- 播放器 CSS 放在播放器模块：`components/player.tsx:12-13`。

**正确之处：**系统字体避免了专门的 CJK 字体下载，不建议为了形式统一而添加大型网络字体。

**不能确认的部分：**

- 源 CSS 行数不能代表编译后 CSS 体积。
- 没有本次 production build 的 gzip/brotli chunk 大小、Coverage 和 long task 数据。
- 本地 `.next` 产物不能保证与当前生产一致，不能据此宣布 JS/CSS 预算达标或超标。

建议 supervisor 在独立工作副本做 production 构建分析，分别记录：

- 首页首访 JS/CSS。
- 普通文章。
- 含视频文章。
- 音频页。
- 单图与多图图集。
- 表单页。

---

## B.5 F11：静态壳、robots、error 和 theme script

### B.5.1 不必要的动态表单页

【已确认事实】

以下页面都只返回 SiteHeader 与客户端表单/组件，却声明 force-dynamic：

- `apps/web/app/login/page.tsx:6-15`
- `apps/web/app/register/page.tsx:6-15`
- `apps/web/app/reset-password/page.tsx:6-15`
- `apps/web/app/redeem/page.tsx:6-20`

登录/注册等请求由客户端交互发起：

`components/login-form.tsx:18-27`、`register-form.tsx:23-30`、`reset-password-form.tsx:18-25`。

兑换页的身份/权益查询也在客户端：

`components/redeem-client.tsx:33-50`。

**P2：**这四个公开壳可以静态化，不需要每次页面访问重新执行服务端渲染。删除对应 force-dynamic 即为小范围修复，私有 API 不变。

兑换页另有一个非首要优化点：

- 先请求 `/api/auth/me`，再请求 `/api/me/entitlements`：`redeem-client.tsx:34-45`。
- 登录用户这里有两次 BFF + API 串行往返。
- 可用一个私有 bootstrap 响应合并；或在明确处理匿名状态的前提下并行。
- `router.refresh()` 见 `:70`，若静态壳不使用服务端私有数据，需重新评估它是否仍有必要。

### B.5.2 robots.ts

`apps/web/app/robots.ts:3-8`：

- 只依赖 SITE_URL。
- 没有 force-dynamic。
- 没有 API 请求。
- disallow `/api/`，sitemap 指向 `/sitemap.xml`。

未发现这里的性能问题。robots 指令不拦截真实请求，也不会替代 API 限流或 sitemap 缓存。部署应保证 SITE_URL 正确，避免输出 localhost。

### B.5.3 error.tsx

`apps/web/app/error.tsx:5-12`：

- 只有用户点击 reset 才重试。
- 没有自动轮询或自动无限重试。
- 客户端边界符合交互需求。

未发现可确认的性能问题。不要与播放器的无界自动重试混为一谈。

### B.5.4 内联主题脚本

`apps/web/app/layout.tsx:12-20,26`：

- 在 head 中同步读取 localStorage、matchMedia 并切换 dark class。
- 不发网络请求。
- 使用 try/catch。

这是有意用少量同步工作减少主题闪烁的实现，没有证据显示它是当前主要阻塞点。优先修图片和数据链路，不建议单纯为了“减少内联脚本”把主题初始化改到晚期 effect，导致可见闪烁。

---

# 附：建议的缓存拓扑改造总图

## C.1 目标拓扑

```text
业务写入
  CLI publish / unpublish / delete / collection update / sort
       │
       ├── 同一 DB 事务写内容、关联、版本/失效事件
       │
       └── 提交成功后投递签名 webhook
              │
              ├── Next revalidateTag / revalidatePath
              │      feed
              │      tag:<旧/新 slug>
              │      collections
              │      collection:<旧/新 slug>
              │      content:<slug>
              │      sitemap
              │
              ├── 更新公开分页 / sitemap 快照
              │
              └── 通知媒体 CDN 处理曝光/封面变化
                     （Next tag 不替代外部 CDN purge）

浏览器
  │
  ├── /、/tags/*、/c、公开详情壳
  │      → Vercel Full Route Cache / ISR
  │      → MISS / 业务失效 / 长 TTL 兜底才渲染
  │      → Next Data Cache：同业务 tag、长 TTL
  │      → 身份无关的公开 API DTO
  │
  ├── 分页
  │      → 公开、无身份入口
  │      → 可验证失效的 CDN 缓存
  │      → 或 revision 对齐的不可变分页 JSON
  │
  ├── 私有全文 / 权益 / 兑换
  │      → BFF no-store
  │      → API 实时认证与权益
  │      → private,no-store
  │
  ├── 公开封面与缩略图
  │      → 图片 CDN / 媒体服务
  │      → 受控尺寸、格式与响应式派生图
  │      → 尽量不经 Vercel Function
  │
  ├── 私有媒体
  │      → BFF / 媒体鉴权
  │      → private,no-store 302
  │      → 短期签名 OSS URL
  │
  └── analytics
         → 内存聚合、事件/生命周期触发
         → 无用户认证的批量 ingest
         → 可选独立采集域名，避免 Vercel 中转
```

### 必须保留的约束

1. **业务变更驱动刷新，长 TTL 只兜底。**不通过一分钟轮询替代可靠失效。
2. **TTL 不是一刀切。**私有内容不共享缓存；签名 302 受签名寿命约束。
3. **Data Cache 命中不等于省掉动态 Function。**
4. **CDN 命中不等于没有 CDN 请求费用。**
5. **Next tag 失效不等于浏览器、OSS、独立 CDN 都被清理。**
6. **缩略图、分页 JSON、公开壳不得包含私有全文或付费媒体签名。**
7. **失败保留上次成功结果，不把 API 暂时失败变成长期缓存的空页。**
8. **更新旧/新关联都要失效。**仅失效新标签、新合集会留下旧页面。
9. **无界重试优先消除。**长 TTL 和 CDN 不能掩盖播放器的无限请求循环。

## C.2 推荐实施顺序

### 第一批：低风险、收益明确

- 修播放器重试上限。
- feed/tags/合集成员查询显式投影，去掉正文读取。
- 匿名公开接口和 analytics 跳过无用认证。
- 图片固定占位；发布写入尺寸；图集减少 eager 请求。
- 内容关联查询并行；合集权益批量化。
- 静态化四个表单壳。

### 第二批：缓存主线

- 实现业务失效 webhook、事件重放。
- 首页、标签、合集列表改长 TTL + tags。
- 正确启用标签按需静态化。
- sitemap 改轻量快照/专用查询。
- 配套失败保留旧结果的测试，不再靠缩短 TTL 等待发布结果。

### 第三批：拓扑优化

- 公开详情 DTO + ISR 壳、私有全文动态化。
- 图片派生图/CDN。
- 可可靠失效的 CDN 分页。
- analytics 独立 ingest。
- 用真实构建分析决定是否进一步拆 Embla、audio/video 依赖。

## C.3 验证要求与命令建议

**本次没有执行以下命令。**构建和 E2E 会写产物，且 E2E 会发布测试内容，应由 supervisor 在独立工作副本/隔离环境执行，不在本次只读审计目录直接运行。

| 验证 | 建议命令/方式 | 必须观察什么 |
|---|---|---|
| 类型检查 | `pnpm typecheck` | 新旧 DTO、tags 参数、媒体尺寸合同 |
| 生产构建 | `pnpm --filter @yoryon/web build` | 路由静态/动态分类、prerender manifest、真实 chunk |
| 现有专项 E2E | `pnpm --filter @yoryon/e2e test tests/feed-pagination.spec.ts tests/collection-pages.spec.ts tests/media.spec.ts tests/analytics.spec.ts` | 分页、权限、媒体、采集回归 |
| Lighthouse | 对匿名首页、普通详情、图集及媒体详情运行 production Mobile/桌面测试，各至少 3 次 | Performance ≥90；记录 LCP、CLS、TBT，不只看总分 |
| 生产媒体缓存 | 同 URL 连续请求、跨浏览器、登录续期分组 | `x-vercel-cache`、Age、Set-Cookie、实际 Function/API 日志 |
| SQL | 与真实查询一致的 `EXPLAIN (ANALYZE, BUFFERS)` | 深分页与热门标签扫描量、排序、索引使用 |
| 账单比较 | 同业务量、同时间窗口前后对照 | Function invocations、ISR writes/bytes、CDN requests、Vercel/OSS 带宽 |

**还需新增或加强的测试：**

- 发布、更新、下架、删除后，不靠等待 60 秒就能看到正确结果。
- 旧/新 tag、collection、sitemap 同时失效。
- API 故障时不覆盖成功缓存为空页/部分 sitemap。
- 1 万条以上 sitemap 的请求数量和完整性。
- metadata/page 单次真实渲染的 API 调用数。
- 永久媒体失败的重试次数上限。
- 登录态匿名接口无 session UPDATE/Set-Cookie。
- 图片加载前后布局稳定。
- public→paid、撤销权益后，公开缓存与私有响应隔离。
- analytics 空队列不发请求、每包装载率、离开页面的有界分包。

### 不能从当前审计直接给出的承诺

- 不能承诺 Lighthouse 已经达到或修复后必然达到 90。
- 不能给出实际 Vercel 账单节省金额。
- 不能把本地 Next 行为等同于已验证的 Vercel CDN 命中。
- 不能确认生产 DB 没有手工索引；这里只能确认 schema 与迁移中没有匹配排序索引。
- 不能将媒体公开 CDN 化视为纯性能改动；它可能改变撤销合同，必须保留访问控制评审。

---

## Review

- **Correct：**
  - 私有正文和权益媒体使用 private/no-store，公开与私有业务语义已有明确边界：`apps/api/src/routes/contents.ts:147,226`、`routes/media.ts:31-38`。
  - feed/tags 已使用 keyset、全序排序和批量 tags 查询：`routes/contents.ts:34-38,55-71,244-260`。
  - Video.js 已有动态加载边界，Markdown 未被直接放进客户端边界：`components/media-player.tsx:8-16`、`components/markdown.tsx:7-12`。
  - 系统字体、空队列不发 analytics、错误页不自动重试均属合理实现。
- **Fixed：**无。本次严格只读，没有应用代码修复。
- **Finding：**F01–F11 如上；优先修复 sitemap 放大、公开渲染缓存、认证写放大、播放器无界重试、图片尺寸/派生图及 SQL/权益查询。
- **Merge verdict：OK with notes。**本次交付为审计报告，没有待合并实现；此结论不表示现有性能已经达标。P1 项应进入下一轮性能改造并完成生产验证。
