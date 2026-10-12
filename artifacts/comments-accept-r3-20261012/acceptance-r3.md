# Issue #14 — bd828ee 第三轮独立现场验收

## 结论与范围

**本轮任务指定的六条执行时序均 PASS，清理 PASS。该结论只针对下表实际执行的路径，不是“所有浏览器竞态均修复”的结论，也不替代独立代码评审。GPT 第三轮静态评审 merge verdict 为 BLOCK，本轮有限时序的 PASS 不推翻该结论，不建议据本工件批准合并。** 第二轮已完成的十项矩阵未重跑；本轮没有修改实现、提交代码、发布产品或启动子代理。

追加指导到达时，本线程已完成 T3–T6 并清理自身数据；其中要求在“T4 尚未执行时”纳入的新序列已错过该前提，因此遵照不重跑已完成项的要求，没有重新前置数据或重复执行 T4。已只读核对提供的 GPT 报告：`/Users/yoryon/.pi/agent/sessions/--Users-yoryon-Projects-yoryon--/subagent-artifacts/bad485f9-71e0-41d9-adc6-bf2a269b41ff_reviewer_output.md`。下面三项静态边界均未现场执行，明确保留为 UNVERIFIED。

| 项目 | 结果 | 实际覆盖 |
|---|---|---|
| T1 时间迁移与分页 | PASS | 0007 一次迁移；旧微秒截断；列精度/default；根、回复、通知跨三页同毫秒 ties 的 SQL/HTTP 完整顺序一致 |
| T2 锁等待跨权限失效 | PASS | PUT 等待跨到期、DELETE 等待期间撤销、POST reply 等待跨到期、POST reply 等待期间取消发布；真实 HTTP + PG Lock 实证 + 无互动变更 |
| T3 通知锚点 | PASS（修正验收前置后） | 根在第二页、回复在第二页，真实生产 Web 自动加载、目标在视口、此前回复第一页仍在 DOM |
| T4 旧根分页响应 | PASS（限定时序） | **旧分页先发出并截获真实响应 → UI 取消点赞 → 首页重载完成 → 释放旧响应**；旧数据未追加，新游标未覆盖，继续翻页得到完整 45 条 |
| T5 旧 liked 响应 | PASS（限定时序） | **旧回复 liked 读先发出 → 同回复 PUT 成功 → 释放旧空响应**；aria-pressed 保持 true，下一次点击实际 DELETE |
| T6 read-all 与分页 | PASS（限定时序） | read-all 挂起时第二页成功，随后注入 503；40 条/未读/游标保留、失败提示可重试；成功重试后释放此前截获的第三页未读响应，最终 60 条已读与 SQL 一致 |
| 自建数据清理 | PASS | r3 作品/评论/通知/会话/权益/兑换/验证码/邮件/缓存事件/临时秘密文件清理；旧 cmt 与 acc 数据保留 |

**额外边界明确 UNVERIFIED：**

1. T4 未执行“新首页重载已经开始、尚未返回，用户再用旧 nextCursor 新发起分页”的时序。以上 PASS 不能证明这个不同边界安全，不能推翻第三轮静态评审相关发现。
2. T6 未执行“read-all 在服务端完成后才提交的新通知”进入分页的时序。本轮迟到页中的 20 条均在 read-all 之前已存在且 SQL 证明被本次 read-all 覆盖；不能扩大为覆盖新增通知仍保持未读。
3. T5 未执行“保留线程回复的 liked 查询挂起期间，对另一条根评论点赞触发根重载”的时序。本轮测试是对查询所含同一回复进行写操作，不是无关根重载；不能证明全局 rootGeneration 不会误丢弃有效回复查询。GPT 此项 P2 仍未现场验证。
4. T2 没有做 PUT/DELETE/reply × 到期/撤销的全笛卡尔矩阵：具体四条如上。锁权限重新校验已实际覆盖两个权限失效来源及三个 HTTP 方法，未覆盖的组合不声称通过。
5. 单机、单 Chromium、headless、桌面视口；未覆盖其他浏览器、移动端、跨进程大压力、定位超过有界页数上限、任意时长网络断连。未执行真正服务器宕机：T6 的 503 为浏览器端明确故障注入。

## 版本、环境与隔离

- HEAD：`bd828ee00a743c25b8c7d7248d03f99d1d986cb8`，`fix(comments): isolate stale requests and recheck access after lock waits`。验收前后 HEAD 相同，tracked diff 与 staged diff 均为空。
- 工作树：`/Users/yoryon/Projects/yoryon-pr3-comments`。运行：2026-10-12 UTC 15:30–15:49 左右。
- macOS 27.0.1（26A434）；Node v24.20.0；PostgreSQL 16.15；Playwright 1.64.0，Chromium 156.0.8078.4。
- 每条业务命令显式 `set -a; source /tmp/yoryon-accept-comments/env.sh; set +a`。未打印 env 文件、数据库连接密码或 BFF 秘密。
- API `http://127.0.0.1:4323`；Web 是既有最新生产构建、3103 端口；隔离 DB `localhost:54329/yoryon_accept_comments`；隔离存储 `/tmp/yoryon-accept-comments/media`；Mailpit 11126 / SMTP 11125。仅访问此验收库、指定服务；没有重启服务、停端口、读取其他业务库。
- T3 匿名浏览器通过 `http://127.0.0.1:3103`。T4–T6 的真实登录/写请求使用**同一服务的 `http://localhost:3103` origin**：现有 `ALLOWED_ORIGINS` 仅允许此 origin。Chromium 显式使用 `--host-resolver-rules=MAP localhost 127.0.0.1`，仍为同一 Playwright/Chromium 机制；未改配置、未伪造 Origin、未绕开 CSRF。
- 两个临时普通用户 `r3_reader` / `r3_actor`：通过真实 API 注册 → 隔离 Mailpit 收到验证码 → 验证邮箱 → 登录，均 200，用户名与激活状态实际确认。T4 另经真实生产 Web 登录表单获取 Cookie 会话，后续浏览器复用该会话。密码/验证码/token/Cookie 只在内存及权限 0600 的 `/tmp` 文件存在，未保存到报告、截图或请求头日志；清理时文件已删除。收信仅送 `accept.invalid` 临时地址的本地 Mailpit，不向真实用户发邮件。
- SQL 边界构造：仅 r3 专用作品、评论/回复/通知、目标行锁、权益链条、一次预置点赞。用户名不是业务真实身份；正文均 `r3-*` 隔离标记。SQL 前置不被当成真实用户发帖或通知产生路径。
- 旧 `cmt-free/cmt-paid` 和 `acc_u1/u2/u3` 未用于本轮互动；既有 0006 数据未还原。0007 按项目迁移合同规范整库旧评论/通知时间，迁移保留。

## T1：微秒时间迁移与三类全序分页 — PASS

前置见 `evidence/02-data-precondition.txt`（实际 SQL 与旧时间回执）：

- r3-free：45 条根评论，旧时间 `.123011` 至 `.123495`，同一毫秒内不同微秒；45 条回复，旧时间 `.456013` 至 `.456585`，同一毫秒内不同微秒。
- r3_reader：60 条通知，旧时间 `.789007` 至 `.789420`，同一毫秒内不同微秒。使用不同合法 UUID，故迁移后会在跨页位置形成真实时间 ties。
- 迁移前 `comments/notifications.created_at` 都为 precision=6、default `now()`；迁移日志 7 条、截至 0006。

只执行一次 `pnpm --filter @yoryon/db migrate`，输出 `migrations applied`。日志新增第 8 条，hash `105631e3ba6873488e762233e5dfa57751ce4b46556553850377a2d619b4f502`。未重新执行或还原迁移。

迁移后现场 SQL：

- 两列 `datetime_precision=3`，default `date_trunc('milliseconds'::text, now())`。
- `created_at <> date_trunc('milliseconds', created_at)` 的剩余行在 comments 与 notifications 均为 0，覆盖迁移规范旧数据，而非只看新 r3 行。
- 直接 SQL 省略 created_at 插入的评论/通知，分别实际为 `15:32:55.374000+00` / `15:32:55.375000+00`，均毫秒对齐。该通知给 r3_actor，不改变 reader 的分页集合。

真实 HTTP 将每个 nextCursor 原样送到下一页，与数据库独立 `ORDER BY` 的完整 ID 序列逐项比较：

- 根：20+20+5，SQL `like_count DESC, created_at DESC, id DESC`。
- 回复：20+20+5，SQL `created_at ASC, id ASC`。
- 通知：20+20+20，SQL `created_at DESC, id DESC`。
- 三者 **顺序逐项一致**，distinct 与全集一致，missing/unexpected/duplicateIds 均为空；每页原始 ID、毫秒时间与解码游标已保留。根/回复时间各恒为 `.123Z` / `.456Z`，通知恒为 `.789Z`，因此跨页等时排序依赖 UUID tie-break，不是靠时间错开避开边界。

证据：`T1-migrate.log`、`T1-time-and-pagination.json`、`00-environment-db.txt`、`02-data-precondition.txt`。

## T2：目标行锁等待后的权限检查 — PASS

使用独立 PG 连接 `BEGIN; SELECT id FROM comments WHERE id=$1 FOR UPDATE` 持有 r3-paid 目标行。另发真实 API HTTP 请求，不调用领域函数。第三连接在 `pg_stat_activity` 观察目标 SELECT 的 `wait_event_type='Lock', wait_event='transactionid'`；通过 HTTP context 证明此时用户有权限；在请求仍未完成时跨到期/撤销/取消发布，然后 `COMMIT` 放锁。

权益前置是 SQL 插入 r3 自有 `activation_codes → redemptions → entitlements` 的合法链条，逐案隔离；到期案为 3 秒短期授权，过期后再放锁；撤销不逆转单调字段，各案创建新权益。

| 场景 | 放锁前证明 | 实际响应 | SQL 终态 |
|---|---|---|---|
| PUT like 跨到期 | context=true；Lock；直到 `.526Z` 放锁，权益 `.360Z` 已到期；总等待约 3177ms | 403 forbidden | like_count=0、likes=0、replies=0、notifications=0，前后完全一致 |
| DELETE like 等待期间撤销 | 预置 likes=1/count=1；context=true；Lock；revoked_at 在放锁前已提交 | 403 forbidden | 原点赞仍保留，count=1/likes=1，无回复/通知新增，前后完全一致 |
| POST reply 跨到期 | context=true；Lock；放锁时已超过 valid_until；总等待约 3172ms | 403 forbidden | replies=0、notifications=0，所有互动字段前后完全一致 |
| POST reply 等待期间取消发布 | context=true；Lock；r3-paid status 改 draft 后放锁 | 404 `内容不存在或未发布` | 没有回复/通知；请求结束后恢复 r3-paid 原 published 状态 |

取消发布案不是权限 403：该路由合同将已取消发布作品作为 404；任务要求为 reply 拒绝，该结果符合实际合同。以上成功判定基于锁观测、响应错误含义与 SQL 无写入，不只看 HTTP status。

证据：`T2-lock-waits.json`，含真实状态、权限到期/撤销时刻、等待 pid、响应 body、互动前后快照。

## T3：真实浏览器跨页锚点 — PASS（前置修正明确保留）

首次命令因本人临时 heredoc 括号笔误在 Node **解析前**退出 1，未启动浏览器。按 supervisor 明确授权仅修正临时语法、同一机制执行，失败回执 `T3-command-parse-failure.txt`。

修正后的第一次浏览器访问等待目标 DOM 20 秒超时，立即停止该路径并报告，未静默重试/换机制。按 supervisor 授权只读诊断，确认：

- `/p/r3-free` 为 404 `404 内容不存在`。
- `/api/public/contents/r3-free` 为 200、SQL 中 published。
- `/api/public/policy/r3-free` 为 404。
- `/p` middleware 使用 API 内存 policy 作发布门禁；SQL 创建内容没有正式发布缓存事件，**尚未到达评论组件**，不是已经执行锚点逻辑的失败。

按明确授权，为 **r3 专用数据前置**执行现有 `pnpm cli publish <本工件的 publish-input/r3-free>`。该操作不是产品发布或实现变更。cache event 实际 `verified`，门禁变 200；随后仅执行先前未到达的浏览器路径。首次超时、HTTP 诊断、发布输入与回执全部保留。

真实最终路径 `/p/r3-free#comment-a3100000-0000-4000-8000-000000000025`：

- 根 `a300…0021` 在第 1 页不存在、第 2 页出现（全序排名 25）。
- 回复 `a310…0025` 在回复第 1 页不存在、第 2 页出现（排名 25）。
- 浏览器自动完成 locate、根第 2 页、回复第 1/2 页；目标 DOM computed visible=true，自动滚动后 targetInViewport=true，无定位失败提示。
- 同根最终回复 DOM 是 1–40 共 40 个唯一 ID，第一页面 1–20 **每一个都仍保留**，不是以第 2 页替换第 1 页；`r3-reply-1` 的真实文字仍可见。
- 目标视口截图及向前滚动的早期回复截图已实际打开人工核对。

证据：`T3-anchor.json`、`T3-anchor-target.png`、`T3-anchor-earlier-replies.png`；前置失败/诊断/修正为 `T3-browser-error.txt`、`T3-diagnostic-page.html`（其内容是 404 纯文本，不是 HTML 页面）、`T3-diagnostic-policy.txt`、`T3-policy-after-publish.txt`、`T3-publish-precondition.log`、`publish-input/r3-free/index.md`。

## T4：重载前已发出的旧根分页 — PASS（不扩大时序）

SQL 预置 reader 对 r3-root-1 有一赞，count=1；生产 Web 登录后按钮实际 aria-pressed=true。初始首页为 root1 + root45…root27，游标 root27。

1. 点击“加载更多评论”。Playwright `route.fetch()` 真正从 BFF/API 取得旧第二页 root26…root7，响应 nextCursor=root7，但不交给页面。
2. 在旧页挂起时，UI 点击 root1“取消点赞”，实际 `DELETE /api/comments/<root1>/like` 200/count=0；组件真实发首页 GET。首页完成后 DOM 恰 20 条 root45…root26，新 nextCursor=root26。
3. 释放旧响应；DOM ID 序列与释放前**逐项完全相同**，没有追加 root25…root7、没有出现旧响应的排序结果。
4. 继续 UI 翻页。实际下一请求使用 root26 新游标，而不是 root7 旧响应游标。最终 45 个 DOM 根 ID 与独立 SQL 完整顺序逐项一致，无重复/缺失，root1 位于最后且未被跳过。

证据：`T4-stale-root-page.json`（每次请求、解码游标、真实响应 ID、四阶段 DOM 与 SQL）与 `T4-stale-page-rejected.png`。

**本项明确不覆盖**新首页请求未完成时从旧 UI 新发起的分页；第三轮评审此边界仍应独立处理。

## T5：旧 liked 查询不能覆盖本地成功互动 — PASS

选择回复 r3-reply-1，避免根点赞带来的首页代次变更掩盖 liked 写版本竞态。复用真实 Web 登录会话，在 `route.fetch()` 取得包含该回复的旧 liked 查询（真实 `liked=[]`）后挂起响应。

- 写前：aria-pressed=false、label=点赞、可点击。
- UI 点击：实际 PUT 200/likeCount=1；等待按钮不再 disabled 后观察 aria-pressed=true、label=取消点赞。
- 释放旧空 liked 响应：仍 aria-pressed=true、label=取消点赞、计数 1。截图实际红色心形 1，与 DOM 一致。
- 下一次 UI 点击：实际方法 **DELETE**（不是重复 PUT），200；最终 aria-pressed=false、计数 0；SQL 当前用户 likes=0、like_count=0。

证据：`T5-stale-liked.json` 与 `T5-old-liked-rejected.png`。该 PASS 是先读→同回复写成功→迟到读的时序，不声称任意根刷新序列都安全。**未覆盖**无关根刷新期间丢弃保留线程回复的有效 liked 查询；此项静态 P2 仍为 UNVERIFIED。

## T6：read-all 503 与通知翻页并发 — PASS（既存通知范围）

首次临时命令使用非法数字开头对象键，Node 解析退出 1，未启动浏览器或操作通知。按 supervisor 授权仅改临时键为合法标识符，保留 `T6-command-parse-failure.txt`；未新增测试脚本或切换机制。

真实 `/notifications` 初始 20 条、20 个 DOM 未读点。故障与并发控制为一次性 Playwright route 操作，不是生产钩子：

1. 点击“全部标为已读”，首个 POST 在浏览器路由挂起，**不向服务端转发**，以便随后明确模拟失败；页面“处理中…”且 read-all disabled。
2. 同时 UI 点击“加载更多”，第二页真实 GET 成功，页面变为 40 条、40 未读点。
3. 对挂起 POST 返回明确注入 503。页面仍保留相同 40 条（DOM 每条文本逐项比较），40 个未读点，SQL 60 条全部仍 unread。显示 `操作失败，请重试。`；“全部标为已读”恢复可点。
4. 再点击加载更多。实际使用 root notifications ID `a320…0021` 的正确下一页游标，第三页真实响应 20 条；先截获其全部 readAt=null 的旧快照，不交给页面。
5. 点击 read-all 成功重试，真实 POST 转发到 API、200，SQL 60 条全部已读；当前 40 条 DOM 未读点消失、失败提示清除。
6. 放行第三页旧未读快照，最终页面 60 条、0 个未读点，“加载更多”消失；三个 HTTP 页的全部 ID 顺序与 SQL 逐项一致。检查截图中迟到页末尾条目无红色未读点。

证据：`T6-read-all-concurrency.json`、`T6-read-all-failure-with-page-kept.png`、`T6-late-page-read-after-retry.png`。

**不覆盖** read-all 后才在服务端创建的新通知；旧页中的 20 条属于本次真实 read-all 的范围。上述已读证明不能用于把新增通知误标已读的静态发现判为不存在。

## 清理、辅助证据与文件边界

- 用既有 CLI `content delete r3-free/r3-paid` 清理作品，并各自收到 cache verified。级联删除 r3-free 的 90 条评论/回复与 r3-paid 的 1 条目标评论。
- SQL 只按两个自建用户 ID、`r3-lock-*` 码、两个 r3 slug 和 r3-free target ID 清理：62 条通知（60 前置 + 1 default + 1 真实点赞通知）、5 会话、4 权益/兑换/码、2 验证码记录、2 用户。3 个自身 cache event 的完整 verified 回执在工件留证后从隔离库清理；未清理其他 cache event。
- 自建内容/评论/通知/用户/会话/权益/兑换/码/分析事件/缓存事件剩余均为 0。Mailpit 仅删除自身两封消息、剩余自身消息=0；两个 `/tmp` 秘密文件均删除。没有创建媒体对象。
- r3-paid 的发布状态在 T2 结束即已恢复，最终删除的是自身内容；旧 cmt 两作品保持 published，cmt-free 46 评论/38 根、cmt-paid 2 评论/2 根；acc 三用户状态/角色与清理前快照相同。没有还原 0007，也不删除旧轮数据。
- 清理后 r3-free Web 404、r3-paid 评论 API 404。证据：`cleanup-before.txt`、`cleanup-cli.log`、`cleanup-sql-mail.json`、`cleanup-web.txt`。
- 父静态检查日志复制为 `typecheck-r3.parent.log`、`build-r3.parent.log`。二者成功，但**本验收线程没有重新运行 typecheck/build，且未以其证明业务通过**。
- 最终所有仓库写入仅在 `artifacts/comments-accept-r3-20261012/`。没有固定测试程序/harness/fixture、没有实现 diff、没有 staged files。现场命令与失败授权记录索引见 `commands-r3.md`；最终文件清单/sha256 及脱敏扫描见 `evidence/final-safety-check.json` 与 `evidence/SHA256SUMS.txt`。

## 下一步

交由主 agent/独立 reviewer 核对上述 SQL、HTTP 时序、DOM 与截图证据。GPT 第三轮静态评审为 **BLOCK**：P1 旧游标归入新首页代次，以及两项 P2（无关根刷新丢弃保留线程回复 liked 查询、read-all stamp 扩大覆盖范围）均不被本轮有限时序 PASS 排除。应独立处理三个 UNVERIFIED 边界，不能以本工件批准合并。此工作树未进行任何修复或产品发布。
