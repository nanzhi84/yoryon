# Issue #27 独立审核与现场验收

时间：2026-10-15，Asia/Singapore。审核者：独立子 agent `review_27`，未参与实现。Issue：https://github.com/nanzhi84/yoryon/issues/27 。PR：https://github.com/nanzhi84/yoryon/pull/28 。

受审源代码：`codex/issue-27-visitors`，`efca58d36380cdfb474588ba6301a7a72e58e006`；功能实现提交 `80e2095`，随后仅追加禁止自动部署的配置。报告提交由主 agent 完成后，最终 PR head 会包含这些证据文件，不改变本轮已验证的功能源码。

**结论：PASS（下述范围）；无已复现的阻塞发现，可合并。** 没有部署、没有生产业务写入、没有真实邮件。独立第二浏览器环境、原生隐私设置与其他引擎有明确未验证项，不能把本次结果扩展为所有浏览器或生产验收。尚未执行清理数据库和停止服务，等待主 agent 合并后清理并追加回执。

## 环境、数据与重复运行前提

- Node 24.20.0，pnpm 11.8.0，Next 15.5.27，PostgreSQL 16（本地 `deploy-postgres-1`，宿主机端口 54320）。仅连接独立数据库 `yoryon_issue27_20261015`。
- API `http://localhost:4027`；Web `http://localhost:3027`。Web 使用本地 **production 构建和 `next start`**，不是仅在 dev mode 验收。
- 配置 `/tmp/yoryon-issue27-20261015/runtime.env`，权限 0600；独立 fs 存储 `/tmp/yoryon-issue27-20261015/storage`。所有命令用 `env -i`，不继承仓库/生产 `.env`。
- 空独立库已应用实际迁移至 0013；CLI 创建公开合集及公开文章 `visitor-check`，可访问 `/c/visitor-check` 和 `/p/visitor-check`，文章无媒体和真实账号。创建方式见 `implementation.md`。
- 浏览器全部由本任务新建 IAB 标签页。只删除本次 `yoryon_analytics_vid` Cookie，不清全部 Cookie，不操作用户既有页面。用于 SQL 关联的随机身份/事件号仅在临时 REPL 内存及 `/tmp` 下权限 0600 的专属文件传递；不进入本工件，清理时删除。
- 每次重复运行请新建命名独立数据库、专属端口和存储，再由 CLI 发布同类公开文章。不要对生产库执行本文时间调整、DDL、prune 操作。现场随机值使用 `crypto.randomUUID()`，不使用固定 UUID、合成 fixture 或固定可执行测试程序。

## 实际命令与回执

工作目录：`/Users/yoryon/.codex/worktrees/issue-27-visitors/yoryon`。

```sh
# 恢复隔离 API（初次检查端口均无监听）
env -i PATH="$PATH" HOME="$HOME" pnpm exec tsx \
  --env-file=/tmp/yoryon-issue27-20261015/runtime.env apps/api/src/index.ts

# 正确的隔离 production 构建
env -i PATH="$PATH" HOME="$HOME" NODE_ENV=production node \
  --env-file=/tmp/yoryon-issue27-20261015/runtime.env \
  /Users/yoryon/.local/bin/pnpm build

# apps/web 工作目录：运行上面的构建产物
env -i PATH="$PATH" HOME="$HOME" NODE_ENV=production node \
  --env-file=/tmp/yoryon-issue27-20261015/runtime.env \
  node_modules/next/dist/bin/next start --port 3027

# 仓库根目录：实际公共 CLI
env -i PATH="$PATH" HOME="$HOME" pnpm exec tsx \
  --env-file=/tmp/yoryon-issue27-20261015/runtime.env \
  apps/cli/src/index.ts analytics visitors --days 7 --limit 100
env -i PATH="$PATH" HOME="$HOME" pnpm exec tsx \
  --env-file=/tmp/yoryon-issue27-20261015/runtime.env \
  apps/cli/src/index.ts analytics overview --days 7
env -i PATH="$PATH" HOME="$HOME" pnpm exec tsx \
  --env-file=/tmp/yoryon-issue27-20261015/runtime.env \
  apps/cli/src/index.ts analytics prune --days 365

# 脱敏 SQL 聚合（实际执行过）
docker exec deploy-postgres-1 psql -U postgres -d yoryon_issue27_20261015 \
  -c 'SELECT count(*) AS events, count(visitor_id) AS identified, count(DISTINCT visitor_id) AS visitors FROM analytics_events;'
git diff --check
```

API 与参数化 SQL 的现场命令通过 `env -i ... node --env-file=... --input-type=module <<'JS'` 执行，依赖使用 API package 的 `createRequire(.../apps/api/package.json)('pg')`；输出只保留聚合和响应。没有写入可执行脚本。操作和参数条件如下，足以重做各个失败/边界步骤：

1. `GET /api/public/contents/visitor-check` 在进程内取得 target；生成随机 event/page/session/visitor 标识。`POST /api/analytics/events` body 使用现有 view 合同，额外分别设置非法 visitor、缺省 visitor、缺省 session、伪造 receivedAt/clientTime、不存在 target。核对已插入事件及账本，不输出标识。
2. 对同一 event 连续原样重投，再换 visitor 重投。以 event_id 参数查询事件行数，并以替换 visitor 参数查询账本行数。
3. 反向排列同一组 20 个 visitor，15 轮并发提交 A→B 与 B→A 的批次；再用第三个 DB 连接锁定已存在 A 行，分别让 A/B 和 B/A 两个 API 的账本事务阻塞，释放锁后核对响应。只记录阻塞事务数与状态码。
4. 迁移验证：独立库单事务中移除新 visitor 列/账本，还原 V1 原始事件形状；逐段执行仓库实际 `0013_anonymous_visitors.sql`；核对已有 649 条事件保留、visitor 全部 NULL、账本空。最后 ROLLBACK 恢复本轮数据。此项是有数据的实际迁移 SQL 验证，不代表完整生产 migrator/备份恢复演练。
5. 缺身份窗口：暂停本轮浏览器后，将已识别事件临时整体减 2 天，运行 `analytics visitors --days 1`，随后整体加 2 天恢复原时间。只缺省身份的窗口显示 N/A；保留混合窗口真实 CLI 输出作对照。
6. prune：API 创建随机身份有效事件后，只将该隔离事件 received_at 与对应 first_seen 调为 366 天前；执行实际 CLI prune 365；再通过 API 发送同身份新事件。使用 `first_seen_at::text` 保留 PostgreSQL 精度，对比清理前后值及 returning 判定。
7. 窗口端点：通过 API 创建四个独立随机身份，再将这四组隔离事件/账本时间分别设为 from/from、from/(from−1ms)、to/to、(from−1ms)/(from−1ms)。一次临时 `pnpm exec tsx --env-file=... -e` 调用实际 `printVisitorSummary` / `printVisitorSessions`，传同一固定 `[from,to)`。没有改生产代码或添加时钟钩子。此项精确边界证明使用 CLI 生产报表函数；普通滚动窗口另由公共 CLI 命令验证。
8. 持久化失败：临时重命名隔离账本，发一个随机有效事件，核对 500 公共错误与 events 零行；finally 恢复原表名。检查 API 普通日志，仅看到静态 `analytics persistence failed` 与请求 ID，无 SQL/参数/visitor。

构建原始回执：`build-review-production.txt`，exit 0。最初沿用配置中的 development NODE_ENV 执行构建，Next 在 `/500` prerender 失败，回执保存在 `build-review.txt`；明确传 NODE_ENV=production 后构建通过。首次错误为验收启动配置，不当作功能缺陷，未修改源码。已有 `typecheck.txt` 为实现侧 `pnpm typecheck` PASS；独立 production build 也完成类型检查。`git diff --check` PASS。

## 真实浏览器操作与证据

使用 CUA：`cua.createBrowserTab('iab', url)`，不传 visible（子 agent 不支持 visibility）；读取 `tab.capabilities.get('cdp').documentation()` 后使用允许的 Network/Runtime 开发能力。每轮交互后获取 AX 状态，截图留存 `article-visible.png`、`collection-visible.png`。

| 场景 | 判定 | 实際结果 / 证据 |
| --- | --- | --- |
| 文章与合集最终可见 | PASS | 正文、合集、合集导航、匿名评论提示正常；上述两张截图 |
| Cookie 属性 | PASS | Secure、SameSite=Lax、Path=/、host localhost、约 180 天；源码无 Domain。`browser-review.json` |
| 刷新、站内导航 | PASS | Cookie 身份不变、刷新 session 不变、Cookie expires 完全不变；导航从文章链接进入合集 |
| 多标签页与关闭重开 | PASS | 同 Cookie；新建和关闭重开的 tab 有各自非空 session。SQL：9 事件、1 visitor、3 session、5 page_view，作品及合集均有事件 |
| 并发首次初始化 | PASS | 两个订阅页无埋点；删除本轮 visitor Cookie，两个新任务 tab 同时 goto 文章。Web Locks 存在；网络中 4 事件均采用最终同一 Cookie；数据库 4 事件、1 visitor、2 session |
| 清除 Cookie | PASS | 并发首次场景创建的新身份不同于此前身份 |
| Cookie 到期 | PASS | `Network.setCookie` 将已有 Cookie expires 设为过去；浏览器立即移除；reload 后生成不同身份 |
| 主机隔离 | PASS | localhost 与 127.0.0.1 有不同 host Cookie；仅证明主机边界 |
| 第二独立浏览器环境 | UNVERIFIED | 新建专属 Chrome 会话失败：Chrome unavailable。主机隔离不能代替独立 browser context、无痕或不同设备 |
| DNT / GPC | PASS，SIMULATED | 在任务订阅页用允许的 Runtime.evaluate 临时覆盖 navigator 属性，再点首页做 SPA 导航保留属性。页面正常；各自没有 analytics 请求；Cookie 缺省。关闭 tab 后模拟解除 |
| Cookie 与 session 不可用 | PASS，SIMULATED | 临时覆盖 document.cookie getter 空/写无效计数；sessionStorage getter 抛 SecurityError；首页↔订阅 SPA 导航。2 个真实浏览器事件经 BFF/API 入库，visitor/session 均 NULL；Cookie 只尝试写 1 次 |

SIMULATED 指真实浏览器的 WebAPI 故障边界注入，**没有声称已开启操作系统或原生浏览器隐私设置**。`Page.addScriptToEvaluateOnNewDocument` 被工具拒绝，本轮没有绕过；因此未验证原生 DNT/GPC 全新 document 启动、原生全局禁用 Cookie 及其他浏览器引擎。`browser-api-sql-review.txt` 保存浏览器网络 event 在数据库中的脱敏聚合；raw visitor/event 标识不写入工件。

## API、数据库和 CLI 业务判定

| 合同 / 失败方式 | 判定 | 实際回执 |
| --- | --- | --- |
| 非法 visitor UUID | PASS | 400 invalid_events；响应不回显输入 |
| 旧客户端缺省 visitor | PASS | 200；事件实际保存，visitor NULL |
| 原样重试及换身份重投 | PASS | 同 event 只 1 条、1 个原 visitor；替换 visitor 账本 0 条 |
| 客户端时钟 | PASS | 伪造 receivedAt/clientTime 被剥离，实际 received_at 在服务端最近 1 分钟 |
| 不存在 target | PASS | accepted 0；不创建 ledger |
| 并发账本写入 | PASS，有限范围 | 30 个反序批次及控制 A 锁的两轮均 200，ledger 保留；没有复现死锁。见 concurrency 两类回执 |
| V1 有数据迁移 | PASS，SQL事务范围 | 649 原始事件保留；visitor 0 个非空；ledger 空；ROLLBACK 后恢复原 schema/data |
| 缺省身份独立窗口 | PASS | identified 0、missing 5、coverage 0.0%；unique/new/returning N/A，不误报 0 |
| 每访客标签页会话 | PASS | 3 事件、重复一个 session 加另一个 session = 2；全部缺 session 的报表行 N/A、missing_session_events 1 |
| 新/回访与覆盖 | PASS | 实际公共 CLI 混合窗口 unique 27 = new 26 + returning 1，missing 5、coverage 99.2%；不输出 UUID |
| 精确窗口端点 | PASS | from 恰等入窗，to 恰等排除；原生产报表函数输出 unique 2/new 1/returning 1；新与回访互斥 |
| 原始 prune 后 first_seen | PASS | 366 天旧原始事件 0 行、对应账本 1 行；后续新事件仍 returning；PostgreSQL 文本精度比较 unchanged true |
| DB 失败原子性 / 日志 | PASS | ledger 临时不可用→500 静态错误；新 event 0 行，恢复表名；普通日志静态错误+requestId，未输出 visitor 或 SQL参数 |
| CLI 参数边界 | PASS | --days 0、--limit 0 非零退出，给出清晰错误 |

早期回执的 `ledger_matches_first_received: false` 及 `first_seen_still_original.unchanged: false` 是 **JavaScript Date 毫秒精度与 PostgreSQL 微秒值做精确等号的错误比较**，不是 ledger 改写。前者复核 ledger 与最早 received_at 差 <1ms；后者重新进行完整 prune/回访过程，以 `first_seen_at::text` 保留原精度比较，unchanged true。修正证据见 `exact-window-and-prune-review.txt`；保留早期原始回执，避免覆盖失败观察。

主要回执：`api-sql-review.txt`、`browser-sql-review.txt`、`browser-api-sql-review.txt`、`cli-visitors-review.txt`、`cli-overview-review.txt`、`cli-window-prune-migration-review.txt`、`exact-window-and-prune-review.txt`。

## Architecture Review — Issue #27

**Risk Level: LOW（当前 scope）。** 栈：Next App Router/React、Hono/Zod、Drizzle/PostgreSQL、Commander CLI。

已检查：依赖方向、模块职责、持久化接口、认证/身份边界、日志边界、事件幂等和事务、ADR-0007/0017、迁移与保留策略。无 host typed findings renderer；按 Markdown 报告。

数据流及依赖：React 埋点→`apps/web/lib/analytics.ts` 队列→`analytics-visitor.ts` 主机 Cookie→同源 BFF→API Zod/目标验证→`@yoryon/db` 事件及账本事务→CLI 原始事件窗口聚合。web 不导入 db/core，DB schema 不反向导入 app，CLI 报表不依赖 API HTTP 或 browser；本次新增模块没有循环依赖。变更手写源文件均小于 500 行，schema 拆分后主 schema 464 行。

Critical / Warnings：没有已证实的阻塞问题。

Observations：

- `apps/api/src/routes/analytics.ts:128` 按首次出现顺序 upsert 多个 visitor，没有统一 key 排序。审阅关注反向行锁顺序可能导致事务 deadlock；实际反序并发和控制锁等待均未复现，**UNKNOWN：不能据此断言绝无死锁，也不能当已证实 FAIL**。可由后续测量决定排序/有界重试，本报告没有修改源码。
- `apps/web/lib/analytics-visitor.ts:43` 无 Web Locks fallback 只保证后续从持久 Cookie 重读收敛；极短首次竞态边界已经 ADR 说明，其他无锁引擎 UNVERIFIED。
- 账本 first_seen 经 pg Date 往返具有毫秒精度；raw received_at 可能微秒。当前 CLI 使用 JavaScript Date 毫秒窗口端点，上述精确边界符合口径；复核时必须避免假设两者原始字符串完全相同。
- 持久账本长期保留为此 issue 明确的最小必要设计（UUID+时间两个字段），不关联账号、不保存最后访问。schema 没有级联目标 FK，prune 只删原始事件，符合历史保留定义。

| ADR | 状态 | 说明 |
| --- | --- | --- |
| ADR-0001 | PASS | 同源 BFF；本次 visitor Cookie 不成为认证身份、不公开透传 |
| ADR-0007 | PASS（被0017明确扩展） | 目标语义、原始聚合、旁路与 event_id 幂等保留 |
| ADR-0017 | PASS（上述范围） | 主机 Cookie、最小 ledger、事务去重、new/returning/coverage 与匿名输出一致 |

## 未验证范围与交付状态

- UNVERIFIED：真正第二 browser context、无痕/不同设备、Safari/Firefox、无 Web Locks 的真实引擎、原生隐私设置、运行中的原生策略切换。
- UNVERIFIED：生产 HTTPS/真实 Vercel 平台、真实流量性能、生产角色权限及完整备份/恢复、长期 180/365 天自然经过。这里使用隔离浏览器到期操作及数据库时间边界操作验证语义，不声称经过真实时长。
- UNKNOWN：没有复现的反序批次行锁死锁边界。
- 暂不生产部署配置已核对：`apps/web/vercel.json` 中 `main=false` 与 `codex/issue-27-visitors=false`。
- 工件文本扫描：UUID pattern 0，凭证 assignment pattern 0；截图只含隔离公开文章/合集。未把原始持久 UUID、token、连接串放入工件。
- 本次源代码只读，新增本报告和验收回执；无新增单元测试、固定测试套件、可执行断言脚本或生产钩子。主 agent 负责最终 artifact commit、PR ready/merge 和合并后的清理。
