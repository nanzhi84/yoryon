# ADR-0003：缓存分线 —— 付费内容不进共享缓存

状态：已接受（2026-10-11 补充修订）

## 背景

Next.js 的 SSR/ISR 与 Vercel CDN 存在多层缓存。若随用户身份变化的响应（付费正文、权益状态、媒体签名 URL 跳转）进入共享缓存，用户 A 的完整正文可能被用户 B 获取——这等价于权限绕过。

## 决策

按"响应是否随身份变化"划两条硬线：

| 线 | 内容 | 策略 |
|---|---|---|
| 公开线 | 信息流、标签筛选、合集元信息（v1 对所有人一致，不含"已解锁"角标） | 可 ISR / `Cache-Control: public, max-age=60, stale-while-revalidate` |
| 私有线 | 内容详情、`/api/me/*`、兑换 | 页面 `force-dynamic` + fetch `no-store`；响应 `Cache-Control: private, no-store` |
| 媒体 302 · 免费 | `/api/media/:id` 命中免费规则（封面或 exposure=free，身份无关） | `Cache-Control: public, max-age=300`（必须小于签名 TTL 900s） |
| 媒体 302 · 付费 | `/api/media/:id` 命中权益规则 | `Cache-Control: private, no-store` |

配套实现约束：

1. 公开线端点的代码中**不允许出现 session 读取**（从实现上保证无变体，而非依赖配置自觉）。
2. 任何读取 session 的端点必须显式 `no-store`；任何渲染权益相关内容的页面禁止 ISR/revalidate。
3. `/api/media/:id` 的 302 分两类：免费曝光（身份无关）允许共享缓存但 max-age 必须小于签名 URL TTL；付费媒体必须 `private, no-store`——缓存付费 302 等于把签名 URL 发给所有人。
4. SSR 的统一 `apiFetch` helper 默认 `cache: 'no-store'`（ADR-0001），需要公开缓存的调用必须显式声明。
5. E2E 验证：授权用户访问后，匿名请求同 URL 必须得到预览版，并断言响应头；媒体 302 同测。

## 后果

- 正面：缓存泄露这一权限绕过路径被制度性关闭；公开内容仍享受 CDN/ISR 性能。
- 代价：内容详情页放弃 ISR 红利，每次请求实时渲染（个人博客规模可接受）。
- 注意：v1 信息流不含按用户变化的"已解锁"角标；若未来加入，信息流须移出公开线或改为客户端获取角标数据。

## 修订记录（2026-10-11）：媒体 302 缓存双线

变更原因：ADR-0006 将媒体统一为私有桶后，免费媒体（封面、预览区媒体）也经 `/api/media/:id` 302 分发；若一律 `no-store`，公开信息流的封面加载将完全失去缓存，性能受损。

修正内容：媒体 302 按命中规则分线——免费规则（身份无关）`public, max-age=300`（小于 900s 签名 TTL，保证缓存副本过期前签名仍有效）；权益规则维持 `private, no-store`。付费内容不进共享缓存的核心决策不变。

## 修订记录（2026-10-12）：公开正文与私有权益分离

公开详情使用身份无关 `/api/public/contents/:slug`：公开文章返回正文，付费文章只返回允许的预览。服务器渲染 HTML、SEO 与 Article JSON-LD；`/p/:slug` 在缓存前读取版本门禁，重写到 `/render/:revision/:slug` 的 24h ISR。版本来自事务内生成的 UUID，旧生成只能写入旧 key，无法越过当前门禁。付费完整正文由客户端私有接口读取，保持 `private, no-store`，不写入 HTML/RSC；加载、错误、重试与恢复前台重新鉴权均可见。

公开 API JSON 使用 `public, max-age=0, must-revalidate`；web Data/Route Cache 通过 tags + paths 主动刷新，24h 仅兜底。合集详情包含按用户变化的解锁状态，继续动态；`/c` 列表与标签页 ISR。所有媒体鉴权跳转在生产保持 `private, no-store`，不扩大媒体共享缓存；此前媒体 300s 共享策略被撤销要求取代。

详情和版本化分页 Middleware 每次调用一次轻量 API 内存门禁，不读取 session/正文，也不逐请求查 DB。单 API 进程重启后从 DB 重建，加载失败或 API 不可用返回 503。多实例扩展前必须使用共享强一致门禁。失效失败时 DB 已提交、缓存待处理，不宣称撤销生效；仅真实 GET 内容/版本验证完成才报告 verified。详见 ADR-0010。

客户端禁用预取与跨导航静态 staleTime；新的网络读取受门禁保护。读者已经保存、下载、显示或浏览器历史恢复的公开副本无法远程召回。已签发 OSS URL 最长剩余有效期 900s，页面失效不会撤销既有 URL。
