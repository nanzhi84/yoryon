# Content Analytics V1 —— 指标口径与事件合同

状态：V1（ADR-0007）。严格限定四项指标：**Impressions、Clicks、Views、Reads**。不做 Depth / 滚动深度。

## 1. 领域语义

- **Work（作品）**：`contents` 表（article / image / video / audio 四种类型，共用一套事件协议，不按类型拆分实现）。
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

CTR 只在同一 placement 内计算；由于每个 Target 只出现在一个列表表面，单 Target 的 CTR 无歧义。标签页等其他表面不采集 impression/click（无 Provider），其入口点击不混入 CTR。

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
    "sessionId":  uuid | null      // 可选，sessionStorage 级短生命周期匿名标识
  }]
}
→ 200 { accepted: n }              // 非法目标（不存在/未发布）静默丢弃，不视为错误
→ 400 invalid_json | invalid_events
→ 429 rate_limited                 // IP 维度限流（60 批/分钟，E2E 可经 RATE_LIMIT_SCALE 放大）
```

服务端规则：

- Zod 白名单校验；`received_at` 由服务端生成（`defaultNow()`），不信任客户端时钟。
- 目标合法性在应用层校验：work 必须 `status='published'`，collection 必须存在。统计路径不读权益、不触碰付费内容。
- 失败隔离：采集请求失败只触发一次有界重试（复用 event_id），随后丢弃，不阻塞内容展示、导航与媒体访问。

## 5. 存储与保留

单表 `analytics_events`（迁移 0002）：`id`、`event_id`（唯一）、`event_type`、`target_kind`、`target_id`、`placement`、`page_view_id`、`session_id`、`received_at`；索引 `(target_kind, target_id, received_at)` 与 `(received_at)`。

- `target_id` 是**无 FK 的多态引用**：作品/合集删除后历史统计保留（CLI 显示 `(已删除 <id前缀>)`），避免错误级联。
- 不建汇总表 / 物化视图 / 分区；聚合直接 SQL GROUP BY，实测瓶颈后再优化。
- **保留策略**：原始事件默认保留 365 天，超期由 CLI 手动或 cron 清理：

  ```bash
  blog analytics prune --days 365
  ```

## 6. 隐私

- 不采集 IP、User-Agent、邮箱、激活码、完整 URL 或任何账号标识；`session_id` 为浏览器 sessionStorage 中的随机 UUID，关闭标签页即失效，无法跨会话关联。
- 尊重拒绝追踪信号：浏览器开启 **Do Not Track** 或 **Global Privacy Control** 时，采集端完全不发送事件。
- API 请求日志仍按既有策略记录解析后 IP（安全审计用途），但不进入 `analytics_events` 表。

## 7. 时间窗口与时区

CLI 报表使用**滚动窗口** `[now - N×24h, now)`，按服务端 `received_at` 过滤；窗口端点以 UTC ISO8601 打印在每次输出首行，不做自然日对齐。派生率分母为零显示 N/A。

## 8. CLI 报表

```bash
blog analytics overview --days 7                 # Work / Collection 分开汇总
blog analytics top --metric views --days 30      # impressions|clicks|views|reads|ctr
blog analytics top --metric ctr --days 30 --min-impressions 20   # CTR 排行默认最小曝光 20
blog analytics content <slug> --days 30
blog analytics collection <slug> --days 30
blog analytics prune --days 365
```
