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
