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

## 修订记录（2026-10-14）：文章入口与浏览器缓存

隔离浏览器发现 canonical rewrite 到静态 ISR 时，Next 会覆盖 Middleware 的 Cache-Control，RSC 被磁盘复用并在点击时产生重复请求；同标签预热后将公开文章改为付费的用例没有观测到旧全文显示，但响应缓存协议不满足每次入口核验要求。

`/p/:slug` 是动态 canonical 页面，使用 `connection()` 保持 HTML/RSC 为 private/no-store；当前 revision 的 no-store 校验移到页面的异步 loading 边界内，校验通过后才读取 revision-keyed 公开 Data Cache。Metadata 与正文在同一请求内使用 React.cache 去重，不接受请求头指定 revision。这样路由可以先显示无正文骨架，内容仍经过当前发布状态校验。不要用 force-dynamic 覆盖所有 fetch，否则会同时禁用公开 Data Cache。`/render/:revision/:slug` 保持 Middleware 门禁与 ISR，旧 revision 请求仍拒绝。

文章标题/封面使用 Next Link 默认 automatic partial prefetch，在 loading.tsx 截止；禁止 `prefetch={true}` 或 `router.prefetch` 完整预取文章。dynamic staleTime=0，static=300 复用空阅读页骨架；每次新导航仍请求当前正文。标题不显示“正在打开…”，加载反馈在独立文章页内。骨架包含站点导航和返回入口；异常显示重试，缺失内容走 notFound。流式响应已经开始时HTTP状态可能为200，必须同时检查最终404/错误界面。浏览器历史恢复的既有公开副本沿用原合同。

少量公开无媒体帖子随公开列表传输全文并在浏览器裁切，最多4096 UTF-8字节/条；付费帖子和大帖展开继续经private/no-store详情接口。该规则与文章页骨架分开。

### 2026-10-14：文章结构骨架

信息流的 `readerLayout` 只携带匿名可见 Markdown 派生的有界几何描述（最多 12 个块，每块最多 12 个长度值），不包含正文文字、媒体标识或链接。付费文章先裁剪公开预览并过滤隐藏媒体。列表协议更新为 `pin-v4`；结构不作为正文或权限缓存使用。

点击文章时，根布局内的 React Context 保存一份当前导航的标题、日期与结构，只允许相同 slug 的 loading 界面使用；离开文章路径清除，不持久化。结构生成在列表请求阶段完成，点击不增加请求。直接进入、新标签打开和缺少结构时回退通用骨架。段落按容器宽度估算换行，媒体仅标记位置并采用通用比例，因此是结构近似，不承诺逐像素复刻正文。正文到达即替换，保留 Shimmer 与减少动态效果偏好。

### 2026-10-15：返回列表时的浏览位置

浏览位置以当前标签页的 pathname + search 为键保存。离开链接时同步记录；异步滚动写入绑定已提交的来源路径，离开与恢复期间暂停写入，避免把路由切换产生的顶部位置写回旧记录。仅 history traversal 请求恢复；普通链接继续使用路由默认的顶部或锚点行为。sessionStorage 不可用时不主动接管浏览器的 scrollRestoration。

追加列表在 layout effect 中恢复与当前版本、初始游标匹配的公开快照，在首帧定位前恢复页面高度；定位等待有界（8 秒）且用户滚轮或触摸可取消。公开、已经完整包含在 feed 的短帖只保存展开项 ID，不保存另行请求的正文；需重新授权请求的展开正文仍不持久化。列表版本不匹配时丢弃旧批次，避免恢复旧权限内容。

页内返回的真实点击来源保存在根 BrowseNavigationProvider（有界 40 项，仅来源路径与时间），不写 Next 的 history.state 扩展字段：流式正文提交会替换那些字段。新文档/刷新后不继承这份来源，返回按钮采用安全 fallback。
