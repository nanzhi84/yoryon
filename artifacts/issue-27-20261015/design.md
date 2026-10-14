# Issue #27 实现前设计与失败方式

版本基线：`origin/main`（实现分支 `codex/issue-27-visitors`）。本运行仅本地隔离验证，不部署、不写生产业务数据、不发送真实邮件。

数据流：浏览器首次有效埋点 → 主机限定的 180 天随机 UUID Cookie → 同源 BFF → UUID 合同校验及有效目标过滤 → 同事务写去重事件与首次观察账本 → analytics CLI 的滚动窗口报表。

边界与职责：

- 浏览器身份与事件队列分开；`visitor_id` 表示浏览器环境，`session_id` 保持标签页会话，`page_view_id` 保持列表/详情浏览实例。
- Cookie 使用 Secure、SameSite=Lax、Path=/，无 Domain。仅创建时设置到期，不刷新有效期；Web Locks 协调支持此 API 的标签页首次初始化，投递前重读 Cookie，不能长期持有不同的内存身份。
- Cookie 不可写时只尝试一次，事件正常发送且身份缺省。DNT/GPC 检查必须先于 Cookie 创建，并在投递时再次检查。
- `analytics_events.visitor_id` 可空，兼容旧客户端，历史事件不回填。
- 最小独立账本 `analytics_visitors(visitor_id, first_seen_at)` 只记已插入有效事件的服务端时间，不保存 IP、账号、设备信息或最后访问。原始事件清理不删除账本；账本长期保留以维持首次观察定义，显式整体删除才重置身份历史。
- `event_id` 去重与账本插入处于同一事务，重投冒用其他身份不能制造虚假首次访客，事务失败不能留下半写状态。
- 报表不输出原始访客 UUID；按窗口内活跃的已识别访客区分 new/returning，并逐位展示窗口内不同标签页 session 数；无 session 不虚构次数。无可识别身份时显示不可计算，缺省身份单列覆盖情况。

实现前列出的失败方式/边界：

1. 同浏览器刷新、站内导航、标签页关闭重开：visitor 复用，浏览实例分别计数，会话符合 sessionStorage 语义。
2. 两标签页并发首次初始化：锁内检查与写 Cookie，投递前以持久 Cookie 为准；无锁浏览器至少后续收敛，不保留内存 UUID。
3. 独立浏览器、清除/过期 Cookie：创建新随机身份。禁用 Cookie/storage：正常浏览与缺省身份事件仍继续，不能每次事件造新访客。
4. DNT/GPC：首次与投递前都停止采集，不能创建/刷新持久 Cookie。
5. 非法 visitor UUID：协议拒绝且不泄露输入；旧事件字段缺省仍采集；重复 event 重投只写一次且不新增账本。
6. 新/回访采用 `[from,to)` 与服务端 received_at；窗口内首次出现后多次访问仍是 new。first_seen 恰好等于 from 属于 new。
7. 原始事件 prune 后已有 visitor 再访问仍为 returning；首次观察账本不受目标删除或原始清理影响。
8. 非法/未发布目标或错误 placement 不制造 visitor；数据库错误普通日志不输出 SQL 参数中的标识。
9. 迁移已有数据时 visitor 为 NULL；历史身份指标不可计算，不假报为 0；混合窗口明确只能覆盖已识别流量。

验证将由主 agent 安排独立子 agent 在隔离浏览器 → API → 数据库 → CLI 现场执行；本文件不充当固定测试程序。
