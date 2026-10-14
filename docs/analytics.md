# Content Analytics V1 —— 指标口径与事件合同

状态：V1（ADR-0007）。严格限定四项指标：**Impressions、Clicks、Views、Reads**。不做 Depth / 滚动深度。

## 1. 领域语义

- **Work（作品）**：`contents` 表（post / article 两种阅读形态，共用一套事件协议，不按媒体拆分作品或统计身份）。
- **Collection（合集）**：`collections` 表。合集统计只反映合集自身的访问行为，**不自动累计成员作品数据**。
- **Analytics Target**：`{ kind: "work" | "collection", id: uuid }`，采集、存储、查询复用同一事件合同。
- 嵌入作品的 `media_assets` 不作为独立 Target；只有发布为独立内容才有对应 Work。

## 2. 指标口径

| 指标 | 触发条件 | 适用对象 |
| --- | --- | --- |
| Impression | 列表卡片可视面积 ≥50%，连续可见 ≥1 秒，且页面处于前台；每个列表浏览实例对同一 Target 最多一次 | Work（首页 feed）、Collection（/c 列表） |
| Click | 用户主动点击列表卡片的标题或封面入口；预取与自动导航不计入；卡片内其他链接（标签等）不计入 | 同上 |
| View | Target 详情页在浏览器真实展示（客户端 effect 执行）；每个详情页浏览实例最多一次；外部直达、刷新、客户端导航均计入；SSR / Prefetch 不产生 | Work、Collection |
| Read | 详情页在前台累计可见停留 ≥10 秒（Page Visibility API，切后台暂停、回前台继续）；每个浏览实例最多一次 | Work、Collection |

派生指标：

- `CTR = Clicks / Impressions`（同一 placement 内计算；见 §3）。
- `Read Rate = Reads / Views`。
- 分母为零显示 **N/A**，不参与排行。
- Reads 仅代表有效停留，不能证明认真阅读。Clicks 与 Views 不互相替代：外部直达可产生 View 而无 Click。

## 3. Placement（列表来源）

首页 feed 是纯内容流（合集为顶层结构，只在 /c 列表曝光），因此列表事件按表面区分：

| placement | 表面 | Target |
| --- | --- | --- |
| `home_feed` | 首页 `/`（含"加载更多"追加的条目） | Work |
| `collection_list` | 合集列表 `/c` | Collection |

CTR 只在同一 placement 内计算；ingest 在服务端强制 placement 与 Target kind 的唯一对应（work ↔ home_feed、collection ↔ collection_list），不一致的事件静默丢弃，因此单 Target 的 CTR 无歧义。标签页等其他表面不采集 impression/click（无 Provider），其入口点击不混入 CTR。

## 4. 事件合同

```
POST /api/analytics/events        （经同源 BFF；批量，单批 ≤ 20 条）
{
  "events": [{
    "eventId":   uuid,             // 幂等键：客户端生成，重试复用，服务端唯一约束去重
    "eventType": "impression" | "click" | "view" | "read",
    "targetKind": "work" | "collection",
    "targetId":  uuid,
    "placement": "home_feed" | "collection_list" | null,   // impression/click 必填；view/read 恒为 null
    "pageViewId": uuid,            // 浏览实例 id（列表实例 / 详情页实例）
    "sessionId":  uuid | null,     // 可选，sessionStorage 标签页会话，不做 30 分钟超时
    "visitorId":  uuid | null      // 可选，主机限定第一方 Cookie 的随机匿名浏览器身份
  }]
}
→ 200 { accepted: n }              // 非法目标（不存在/未发布）静默丢弃，不视为错误
→ 400 invalid_json | invalid_events
→ 413 payload_too_large            // 请求体 > 32KB（BFF 与 API 双侧有上限流式读取：
                                   // Content-Length 预检 + 逐 chunk 字节累计，chunked/多字节不绕过）
→ 429 rate_limited                 // IP 维度限流（60 批/分钟，E2E 可经 RATE_LIMIT_SCALE 放大）
```

服务端规则：

- Zod 白名单校验；`received_at` 由服务端生成（`defaultNow()`），不信任客户端时钟。
- 目标合法性在应用层校验：work 必须 `status='published'`，collection 必须存在。统计路径不读权益、不触碰付费内容。
- 失败隔离：采集请求失败只触发一次有界重试（复用 event_id），随后丢弃，不阻塞内容展示、导航与媒体访问。

## 5. 存储与保留

原始事件 `analytics_events`（迁移 0002，0013 新增可空 `visitor_id`）：`id`、`event_id`（唯一）、`event_type`、`target_kind`、`target_id`、`placement`、`page_view_id`、`session_id`、`visitor_id`、`received_at`；索引 `(target_kind, target_id, received_at)`、`(received_at)` 与 `(visitor_id, received_at)`。

最小首次观察账本 `analytics_visitors(visitor_id PRIMARY KEY, first_seen_at)`（0013）：仅存随机身份与首次成功入库的有效事件服务端时间，不存最后访问、IP、账号或设备信息。事件去重与账本 upsert 在同一事务中，只有实际插入的事件更新账本；重复 `event_id` 重试不会创建额外访客，非法目标/placement 不创建访客。

- `target_id` 是**无 FK 的多态引用**：作品/合集删除后历史统计保留（CLI 显示 `(已删除 <id前缀>)`），避免错误级联。
- 不建汇总表 / 物化视图 / 分区；聚合直接 SQL GROUP BY，实测瓶颈后再优化。
- **保留策略**：原始事件默认保留 365 天，超期由 CLI 手动或 cron 清理：

  ```bash
  blog analytics prune --days 365
  ```

- 首次观察账本**长期保留，不随 prune 删除**：事件过期、目标删除都不能将已有身份重新判为新访客。Cookie 有效期不因记录账本而延长；账本不用于复建 Cookie 或关联其他身份。若决定整体停止此统计并删除身份历史，应显式删除账本与相应事件；这会重置首次观察口径（ADR-0017）。
- 历史事件 `visitor_id` 保持 NULL，不按 session、IP 或账号回填；上线前窗口的匿名独立/新/回访访客不可计算，不能报为 0。报表无可识别事件时打印 N/A，混合窗口单列缺省身份流量，只对已识别部分计算。

## 6. 隐私

- 不采集 IP、User-Agent、邮箱、激活码、完整 URL 或任何账号标识；`visitor_id` 仅由 `crypto.randomUUID()` 随机生成，不使用设备指纹、不关联登录身份、不做跨设备跟踪。它表示**浏览器环境，不是真实人数或全站全部到访人数**。
- 第一次需要采集事件时读取/创建 `yoryon_analytics_vid` Cookie：`Secure; SameSite=Lax; Path=/; Max-Age=15552000`，不设置 Domain，限定当前主机，180 天从创建时起计算。复用时只读、不无限续期。`session_id` 仍为 sessionStorage 级标签页会话，`page_view_id` 为列表/详情浏览实例，三者不互相替代。
- 支持 Web Locks 的浏览器在锁内再次读取并初始化 Cookie，投递前重读 Cookie；不支持锁时使用写后读取并在后续投递时重读，避免标签页长期沿用不同内存身份。Cookie 不可写时本页只尝试一次，正常浏览和既有事件继续，但 `visitor_id` 缺省；不为每个事件生成新访客。若在初始化锁完成前卸载，beacon 允许身份缺省。
- 清除/过期 Cookie、更换浏览器、无痕环境、更换设备可能产生新身份；共享浏览器可能计为同一访客。sessionStorage 的浏览器恢复/复制语义仍适用，不代表实际访次。
- 尊重拒绝追踪信号：浏览器开启 **Do Not Track** 或 **Global Privacy Control** 时，不创建/刷新持久 Cookie，完全不发送事件；投递前再次检查，丢弃尚未发送的队列。
- API 请求日志仍按既有策略记录解析后 IP（安全审计用途），但不进入 `analytics_events` 表。
- 持久访客 UUID 不进入普通日志、公开响应、CLI 输出或验收工件；持久化失败日志只保留请求 ID 和静态错误上下文，不打印可能包含 SQL 参数的异常。

## 7. 时间窗口与时区

CLI 报表使用**滚动窗口** `[now - N×24h, now)`，按服务端 `received_at` 过滤；窗口端点以 UTC ISO8601 打印在每次输出首行，不做自然日对齐。派生率分母为零显示 N/A。

匿名访客指标：

| 指标 | 定义 |
| --- | --- |
| 匿名独立访客 | 窗口内至少有一个有效事件的不同 `visitor_id` 数 |
| 新访客 | 上述活跃身份的站内 `first_seen_at` 位于 `[from,to)` |
| 回访访客 | 上述活跃身份的站内 `first_seen_at < from`；与新访客互斥 |
| 已知标签页会话次数 | 窗口内每个身份关联的不同非 NULL `session_id` 数；缺省 session 事件单列，全部缺省时次数为 N/A |
| 身份覆盖 | 有 visitor_id 的事件数 / 全部有效事件数；缺省身份不计入上述访客指标 |

窗口内第一次出现后多次回来的身份仍属于该窗口的新访客。多个 page_view 不等于多个标签页会话，不能据会话数证明真实访问次数。

## 8. CLI 报表

```bash
blog analytics overview --days 7                 # Work / Collection 分开汇总
blog analytics visitors --days 7 --limit 20      # 匿名访客、覆盖情况、每位访客的已知标签页会话次数
blog analytics top --metric views --days 30      # impressions|clicks|views|reads|ctr
blog analytics top --metric ctr --days 30 --min-impressions 20   # CTR 排行默认最小曝光 20
blog analytics content <slug> --days 30
blog analytics collection <slug> --days 30
blog analytics prune --days 365
```

`overview` 同时展示匿名访客概览。`visitors` 行号仅标识本次报表的行，不持久、不输出 UUID；按已知会话次数排序，最多展示 `--limit` 位（1–1000，默认 20），概览汇总始终覆盖完整窗口。

## 帖子与引用的统计边界

旧四类型迁移保留 contents.id 和历史事件，原 URL 不变。首页原地展开、收起、查看图片、挂载/播放/停止媒体不调用 Click/View/Read；帖子明确的详情与评论入口沿用作品 Click，进入详情后再由 DetailTracker 记录 View/Read。长文仍只通过详情入口阅读。

引用卡片不额外记为顶层 Feed 曝光，也不复制评论或事件归属。引用跳转使用普通站内链接，原作品详情的 View/Read 正常计入原作品；Click 的原统计范围仍限顶层作品标题、封面以及帖子明确的详情入口。以上新交互没有扩展旧 Click 指标的含义。

## 合集阅读流程（Issue #26）

合集以独立对象采集列表 Impression/Click、目录详情 View 和流程 Read，不把章节事件求和。每次独立进入合集建立浏览器内存中的流程实例；目录入口、开始/继续阅读、上一篇/下一篇和返回目录通过已验证合集上下文沿用该实例。目录每次真实展示可产生 View，章节仍只产生作品自己的 View。离开链路、刷新或外部直达不会复用之前的流程累计。

合集 Read 在同一流程内累计目录与有权限章节正文的前台展示时间，达到 10 秒最多一次。加载、错误、未解锁预览与后台时间不累计；正文的 Work Read 同样从实际授权正文展示开始。合集 Read Rate 为流程 Reads / 目录 Views，不代表章节阅读率、完读率或读完人数。章节入口不计为合集卡片 Click。

本地续读只保存版本、稳定章节 ID、更新时间，以合集 ID 分组；它既不是权限凭证也不是分析事件，不同步账号或其他设备。目录和成员 API 校验定位，撤回、删除、移出合集后清理；付费章权限由单篇接口实时判断。存储不可用时仍可正常阅读。
