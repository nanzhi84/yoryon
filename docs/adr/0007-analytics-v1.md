# ADR-0007: Content Analytics V1 —— 单事件表 + 同源轻量采集

状态：已接受（2026-10-11）

2026-10-15：匿名跨会话身份与首次观察保留由 [ADR-0017](0017-anonymous-visitors.md) 扩展；原始事件聚合、目标边界、幂等与采集旁路原则保持适用。

## 背景

需要量化首页标题/简介/封面的吸引力与详情页有效消费，限定 Impressions / Clicks / Views / Reads 四项指标（Issue #1）。不引入第三方 Analytics SDK、Redis/Kafka/ClickHouse、独立 Worker 或 Web Admin。

## 决策

1. **单表原始事件 `analytics_events`，无汇总表/物化视图/分区。** 个人站量级下 SQL GROUP BY 足够；实测瓶颈后再优化。
2. **多态 target（work→contents / collection→collections）不设外键。** 目标合法性由 ingest API 在应用层校验（work 必须已发布）；目标删除后历史统计保留，避免级联误删。
3. **幂等键 `event_id`（客户端 UUID + 服务端唯一约束）。** 浏览器端失败只重投一次并复用 event_id，重复投递（Strict Mode、重试、beacon 重发）由数据库去重。
4. **placement 区分列表表面：`home_feed`（首页）与 `collection_list`（/c 合集列表）。** feed 改为纯内容流后，合集的唯一列表曝光面是 /c；CTR 只在同一 placement 内计算，每个 Target 只有一个列表表面，口径无歧义。标签页等表面不采集。
5. **服务端时间为准（`received_at` defaultNow）**，不信任客户端时钟；CLI 报表用滚动窗口并显式打印 UTC 范围。
6. **隐私最小化**：不存 IP/UA/URL/账号标识；session_id 为 sessionStorage 级匿名 UUID；尊重 DNT/GPC 拒绝追踪信号，命中即完全不采集。
7. **采集是旁路，不是关键路径**：任何采集失败（校验、限流、网络、DB）都不阻塞内容展示、导航、付费裁剪与媒体访问；非法目标静默丢弃并返回 200。

## 备选方案（已否决）

- 第三方 SDK（Plausible/Umami 等）：无法表达"合集/作品统一 Target + 前台停留 Read"口径，且引入外部数据出境与运维依赖。
- 汇总表/物化视图：V1 数据量不值得，增加一致性与迁移负担。
- target_id 外键 + ON DELETE CASCADE：删除作品会丢失历史统计，违背"历史保留"语义。

## 后果

- 聚合查询随事件量线性增长；达到瓶颈时的演进路径是 nightly 汇总表（不改事件合同）。
- `analytics_events` 需定期 `blog analytics prune` 清理（保留策略 365 天，见 docs/analytics.md §5）。
