# PR #28 / Issue #27 独立代码与架构审核

- 审核版本：`efca58d36380cdfb474588ba6301a7a72e58e006`，基线 `origin/main`。
- 审核日期：2026-10-15（Asia/Singapore）。只读代码，未修改实现、操作浏览器、推送或合并。
- 风险：LOW。源码审核结论：PASS，未发现需要阻止合并的缺陷；业务验收以另一个独立 reviewer 的真实浏览器/API/SQL/CLI 报告为准。
- 使用 `architecture-review` 技能；读完整 Issue、根 AGENTS、相关 ADR、完整变更与调用方。无 `.agent-context`；按 `docs/architecture.md` 和 ADR 推导边界。host rendering: not available。

## 检查与证据

数据流为需要采集的浏览器事件 → 可选随机 Cookie → 同源 BFF → Zod 合同及目标校验 → 同事务事件去重与首次观察账本 → CLI 滚动窗口聚合。身份不作为阅读权限或账号凭据。

| 检查 | 源码结论 | 证据 |
| --- | --- | --- |
| Cookie 范围、固定到期、不续期 | PASS | `apps/web/lib/analytics-visitor.ts:28-35` 仅缺省时创建；Secure、SameSite=Lax、Path=/、180 天、无 Domain。复用路径只读。 |
| 多标签页初始化和不可用存储 | PASS | `analytics-visitor.ts:15-24,40-57` 不保存内存 UUID；Web Locks 锁内再次读取，限时 1500ms；不可写后不逐事件生成身份。无锁路径在后续投递重读 Cookie。 |
| DNT/GPC 和失败隔离 | PASS | `analytics-visitor.ts:9-12,29,41` 初始化前检查；`apps/web/lib/analytics.ts:70-87,105-118` 投递前再次检查并丢弃队列，缺省身份仍可采集。 |
| 重试身份与 event_id | PASS | `analytics.ts:115-118,148-150` 仅首次投递填 visitorId，重试保留事件 ID 和原身份；不会因 Cookie 更换将已投递事件改认新身份。 |
| 旧客户端及历史事件 | PASS | `apps/api/src/routes/analytics.ts:19-28,102-113` visitorId 可空，Zod 校验 UUID；迁移 `0013_anonymous_visitors.sql:1-7` 仅新增可空列，不回填旧事件。 |
| 合法性与首次观察 | PASS | `analytics.ts:72-103,115-133` 先过滤 placement/目标，再 INSERT RETURNING；只有实际插入事件参与账本。重复事件换身份不制造访客。 |
| 账本原子性、并发与保留 | PASS | `analytics.ts:116-132` 事件与账本同事务，upsert 取 least(first_seen_at, excluded.first_seen_at)；`apps/cli/src/commands/analytics.ts:255-261` prune 只删原始事件。 |
| 新/回访互斥和覆盖情况 | PASS | `apps/cli/src/commands/analytics-visitors.ts:7-28` 活跃事件用 `[from,to)`；新访客 first_seen 在窗口内，回访 first_seen < from；NULL 身份单列，无可识别事件输出 N/A。 |
| 标签页会话与脱敏 | PASS | `analytics-visitors.ts:32-50` count(distinct session_id) 忽略 NULL，缺省单列；只输出本次行号、类别和次数，不输出 UUID。 |
| 普通日志与公开响应 | PASS | `apps/api/src/routes/analytics.ts:134-140` 捕获可能带 SQL 参数的持久化异常，仅静态错误和 requestId；`apps/api/src/app.ts:41-61` 普通请求日志无 Cookie、body 或 visitorId。 |
| 依赖方向与文件边界 | PASS | web 身份模块无 DB 依赖；API 负责协议/合法性，db 负责表结构，CLI 负责聚合。schema-analytics 独立导出，未引入反向依赖或新循环。变更手写 TS/TSX 最大 464 行。 |

这里的 PASS 是可从源码确定的合同判断，不表示本 reviewer 执行了浏览器或迁移验收。另一个 reviewer 的当前并发回执 `concurrency-review.txt` / `concurrency-review-staggered.txt` 记录了反序批次与受控锁等待返回 200；本次未据潜在竞争虚构 FAIL。

## 合并阻塞项

无。

## 结构观察与已知边界

- 无 Web Locks 浏览器的极短首次竞态允许初始身份短暂分叉，但后续读取持久 Cookie 收敛，不长期使用不同内存编号。此边界已在 `docs/adr/0017-anonymous-visitors.md:12,23` 明示，不能把支持锁的浏览器验收推及所有环境。
- 账本长期保留随随机身份量增长，只有两个必要字段；这是保留首次观察口径的明确取舍（`ADR-0017:14-16,22`），未据个人站的假设规模要求汇总表、后台任务或额外存储。
- sessionStorage 的复制/恢复语义和 Cookie 的清除/到期会影响匿名统计；文档已明确其为浏览器环境及已知标签页会话，不能解读为真实人数或准确访次。

## ADR 一致性

| ADR | 状态 | 说明 |
| --- | --- | --- |
| ADR-0007 | PASS | 保留原始事件聚合、target 无 FK、event_id 幂等、采集旁路；单表限制由 ADR-0017 明确扩展。 |
| ADR-0017 | PASS | 随机 Cookie、最小账本、长期 first_seen 保留、隐私和 CLI 口径与实现一致。 |
| ADR-0003 | PASS | 本变更不把权益正文或身份统计暴露为共享可读响应。 |

## 未验证与后续整合

本 reviewer 未独立执行浏览器身份复用、native 后台标签页、无锁浏览器、真实安全上下文 Cookie、迁移及 CLI 查询，均由业务验收报告分别给出实际结果与未覆盖项。未验证生产，未部署。

两 PR 合并顺序为 #28（0013）后 #29（0014）。#29 rebase 时应保留 journal 的 13→14 顺序，0014 snapshot 的 prevId 链到 0013，并累计 analytics_visitors/visitor_id 与 collection 字段；当前分支分叉状态不算 #28 缺陷。集成后须核对累计迁移链，避免下一次 db:generate 再产已有字段 DDL。

## 可重复审核命令

在该 worktree 执行 `gh issue view 27 --repo nanzhi84/yoryon --json title,body,comments`、`git diff origin/main...HEAD`、`nl -ba <上述文件>`、`git diff --name-only origin/main...HEAD | rg '\.(ts|tsx)$'`，对这些手写文件运行 `wc -l`。无生产配置、真实访客数据、凭据或持久访客标识参与本审核。
