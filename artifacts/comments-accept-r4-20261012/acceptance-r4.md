# Issue #14 — e8c0846 第四轮独立现场验收

## 结论（限定本轮三个边界与直接影响）

**A PASS；B PASS；C 的业务边界 PASS（PATCH 响应正文及点击后原页面 DOM 为 UNVERIFIED）；清理 PASS。** 没有发现这三个合同的业务阻塞失败。发生一次 Playwright 响应正文读取失败，立即停止原路径、保留失败回执，经明确授权只读核对已发生操作，并执行此前尚未开展的独立 GET503 边界；没有重发 PATCH 或重跑已完成序列。

| 项目 | 结果 | 独立现场事实 |
|---|---|---|
| A：新首页挂起时不能复用旧游标 | PASS | 实际 UI 加载两页40条；根PUT触发新首页，截获真实响应未交付；普通分页按钮移除；调用此前捕获的真实旧UI回调，没有产生任何分页GET；释放新首页后使用其新游标，最终43个ID与SQL完整顺序一致、无重复/缺失 |
| A：新首页503后恢复 | PASS | 根DELETE已成功、首页故障注入503；可见“评论列表刷新失败。重试”；点击重试后重载首页并恢复分页，最终43个ID再次与SQL完整顺序一致 |
| B：无关根重载不丢保留线程的有效liked读 | PASS | 回复已被当前用户点赞（SQL一条点赞/count=1）；真实liked响应确实含回复并挂起；另一根PUT触发首页重载，线程根仍在首页且展开保留；释放回复liked后aria-pressed=true；下一次实际DELETE200，SQL当前用户点赞/count均0 |
| C：UPDATE完成后才提交的通知 | PASS（证据限定） | 独立PG事务插入后页通知但不提交；浏览器read-all真实UPDATE完成，独立连接确认43条均已读且新通知不可见；再COMMIT新通知，read_at仍null；放行POST后页面40→20重置分页，继续真实翻至44条，只有新通知未读；点击真实PATCH、服务日志200、SQL已读 |
| C：成功POST后首页GET503 | PASS | SQL前置仅重置一条自身通知未读；真实POST200、SQL44条全已读；随后首页GET注入503，独立“重试刷新”可点且旧游标无普通分页入口；点击只发一个GET，不再POST；首页20条均已读、游标/加载更多恢复 |
| C：失败POST保留并发追加页（轻量抽查） | PASS | 挂POST且不转发，第二页真实加载至40条，再返回503；失败提示可见，逐条DOM文本/时间/未读点完全不变，SQL43条仍未读，加载更多和read-all均可点 |
| 清理 | PASS | 自建作品/评论/点赞/通知/用户/会话/验证记录/邮件/缓存事件/临时秘密和发布源清理；旧cmt/acc选定快照精确相同；Web/API/policy均404 |

**可见残留（非本轮分页合同阻塞）：** A 503重试成功后，“评论列表刷新失败”独立提示消失、分页恢复，但泛化的“点赞或列表刷新失败，请重试。”仍保留。没有把这一旧提示残留隐去，也不声称所有错误UI都已修复。

本工件不代替独立代码评审或批准合并。r2十项、r3六项没有重跑；特别没有重跑r3“旧分页先发出→重载后释放”或“同回复本地写版本”序列。没有执行0007迁移、修改实现、commit/push、启动子代理、重启服务或停其他端口。

## 版本、环境与隔离

- 冻结 HEAD：`e8c0846a0591f5f74371ccfa6d50bec584d6ed4f`，`fix(web): bind cursors to list generations and reread notification state`；目录 `/Users/yoryon/Projects/yoryon-pr3-comments`。起始/结束版本一致；实现 tracked diff、staged diff 均为空。
- 现场业务执行 UTC：2026-10-12 16:11–16:25（报告随后收口）；macOS 27.0.1 (26A434)，Node v24.20.0，PostgreSQL 16.15；Playwright 1.64.0，实际 Chromium `156.0.8078.4`，headless，1200×900，locale zh-CN。UI显示新加坡时间（UTC+8），不将显示日期误当UTC。
- 既有 API `http://127.0.0.1:4323`；生产 Web `http://localhost:3103`；隔离 DB `localhost:54329/yoryon_accept_comments`；SMTP127.0.0.1:11125 / 本地 Mailpit11126 v1.31.4；无媒体输入或上传。
- 每条业务命令加载 `/tmp/yoryon-accept-comments/env.sh`，没有输出完整env、连接凭证或BFF秘密。无内置 Browser工具，使用用户指定的同一Playwright路径与 Chromium `--host-resolver-rules=MAP localhost 127.0.0.1`；真实登录与写请求保持受信 Origin `http://localhost:3103`，未绕CSRF/门禁、未换机制。
- 起始数据库两列created_at精度=3、default为毫秒截断now()，迁移记录8条；只查询，没有再次迁移。Web/API/Mailpit初始可用性仅是环境观测，不作为业务PASS依据。
- `r4_reader` / `r4_actor` 两个普通用户：真实 API register→隔离 Mailpit验证码→verify-email→login，每一步均成功并核对用户名。A通过生产浏览器真实登录表单获取Cookie会话；B/C复用该会话。只向本地`accept.invalid`隔离邮箱发信。
- 密码/验证码/token/Cookie仅在内存或0600 `/tmp/r4-accept-secrets.json`、`/tmp/r4-browser-state.json`，没有进入报告、截图、响应头日志；已清理。

## 数据前置（SQL边界构造，不冒充真实发帖）

`r4-free` 先通过现有CLI `publish /tmp/r4-publish-source/r4-free` 正式发布；cache event verified、policy/Web200后才进入评论路径。没有仅SQL设published后直接访问/p。发布源为临时Markdown，无媒体；源文本：标题“r4 评论与通知边界验收”、slug r4-free、published_at `2026-10-12T16:12:00.000Z`、正文“仅用于本地隔离现场验收；无媒体。”。

实际SQL完整保存在 `evidence/03-data-precondition.txt`：

- 43条根，UUID `a4000000-0000-4000-8000-000000000001` 至 `…043`，正文r4-root-N，时间同为`2026-10-12T16:12:00.123Z`、初始赞数0；跨页依赖ID tie-break而非错开时间。
- 1条回复 `a4100000-0000-4000-8000-000000000001` 属root43。预置当前reader点赞/count=1；B前又实际查询证实，且B挂起的liked真实返回该ID。
- 43条reader通知，UUID `a4200000-0000-4000-8000-…001` 至 `…043`，reply类型、关联自建作品/root43；时间13:01至13:43 UTC逐分钟独立，均未读。
- C后提交目标 `a4200000-0000-4000-8000-000000000099`，12:01:00.333 UTC，比所有既有通知旧，落在第三页；like类型且无作品/评论link，DOM以独特类型和时间识别。没有给生产功能加测试钩子或仓库fixture。

## A 证据与旧游标来源

现场保存了初始两页DOM完整ID（root43…root4）和第二页真实请求游标边界root24。此次记录没有保存该第二页原响应body，因此“旧40条后的nextCursor”另以**只读补充查询**相同请求、核对第二页ID仍逐项等于原DOM后20条来佐证，明确不伪称它是原截获响应；没有重跑A。

旧40条边界游标解码为 `{l:0,t:'2026-10-12T16:12:00.123Z',id:'a4000000-0000-4000-8000-000000000004'}`；补查询返回值保存在 `A-old-cursor-corroboration.txt`。新首页在root23 PUT成功后真实返回root23 + root43…root25，新游标边界root25（与旧root4不同），完整body保存在 `A-root-generation.txt`。

真实新首页响应通过route.fetch取得但未交付时，DOM仍为原40条、出现“正在刷新评论…”，普通“加载更多评论”不存在。为验证不仅隐藏按钮，还在读取边界拒绝已持有的旧UI闭包，现场内存捕获此前真实按钮React onClick并在此时调用：额外网络请求为空。没有直接调用内部hook、伪造游标请求或改实现。放行首页后普通UI连续翻页，首个请求使用新root25游标，完整43条与SQL `ORDER BY like_count DESC,created_at DESC,id DESC` 逐项一致。

503为浏览器端明确注入（不是实际服务宕机）；根DELETE仍真实执行。失败时游标被作废、加载更多不存在，独立可见重试存在；重试真实GET首页/context后继续分页，43条全序一致、无重复。截图 `A-home503-retry.png` / `A-final-complete.png`，残留泛化提示已披露。`A-refresh-pending.png`因点击位置滚动只展示旧列表局部；刷新提示与分页入口状态以同期DOM回执为据，不用这张局部截图单独证明。

## B 证据

目标回复的真实liked读先取得 `{liked:[replyId]}` 并挂起；DOM已经显示回复，此时由于读未交付按钮暂为false。随后点击另一个root42，实际PUT并触发真实根首页重载。root43仍在新首页、同一回复DOM仍可见、“收起回复”仍存在；期间没有对回复本地写，也没有新的回复liked查询取代旧读。

释放原读后，aria-pressed=true、label取消点赞，截图红心1；下一次实际DELETE200/likeCount=0，SQL当前用户点赞行0/count0，截图空心0、线程仍展开。完整时序/请求/SQL在 `B-retained-reply-liked.txt`，截图 `B-liked-after-unrelated-root.png` / `B-delete-final.png`；不是只看HTTP200。

## C 时序、工具失败与独立判定

1. 轻量失败案：初始20未读，POST挂起不转发，第二页真实到40条，再注入POST503。40条DOM文本/时间/未读点与放行前逐项相同；SQL43条read_at仍null，按钮恢复。没有重复r3完整T6的迟到第三页案。
2. 新通知事务：`BEGIN; INSERT ... RETURNING`于16:19:57.126Z完成但不提交；独立连接看不到新行。真正POST通过route.fetch执行；16:19:57.165Z已收到成功服务响应，独立SQL确认43条全部read_at非null且目标不存在。**16:19:57.167Z才COMMIT**，目标read_at仍null，再释放POST给页面。
3. 页面按本轮合同从首页重读，旧40条重置20条；真实20+20+4翻页。三页HTTP ID与SQL `ORDER BY created_at DESC,id DESC` 全序逐项一致、无重复，DOM每条时间/actor/事件类型/未读点与HTTP投影逐项一致。既有43条已读，只有12:01:00.333 UTC的新目标未读；截图`C-late-commit-unread.png`已人工打开核对红点、黑体与其他已读灰字。
4. 16:19:57.425Z真实点击发PATCH `/api/notifications/<…099>/read`。随后Playwright Response.json遇到Protocol error/No data found；原命令退出1，`C-command.txt` / `C-authoritative-notifications.txt`保留STOP/UNVERIFIED，**未重发PATCH、未重跑原序列**。
5. 立即报告并按supervisor明确授权仅只读SQL：同目标此前null→read_at `16:19:57.430Z`，时间紧随唯一已记录PATCH；现有服务日志中同路径、当前reader、status200。`C-patch-sql-followup.txt`保留真实日志行。独立业务判定：新通知未读、点击发送PATCH并SQL已读均PASS；**PATCH响应正文与点击后原页面DOM为UNVERIFIED**，不把工具错误写成业务成功响应正文。
6. 经明确授权执行尚未开展的独立GET503案，仍同Playwright。SQL只将自身root43通知read_at重置null以使UPDATE可观测；新浏览器生产通知首页实际显示1个未读。真实POST200后SQL44条全已读，紧接首页GET注入503：可见独立“通知列表刷新失败。重试刷新”，旧列表未读点暂保留，游标入口移除。点击重试仅发 **GET /api/notifications**，没有再POST；首页20个HTTP ID等于SQL前20，DOM与权威readAt一致、0未读、错误消失、“加载更多”恢复。`C-get-only-retry.txt` / 两截图为据。

本路径的业务结论由上述实际内容/顺序/事务可见性/SQL/DOM综合判断，原临时命令STOP与独立判定并列保留，不覆盖失败回执。

## 清理与工件安全

- 现有CLI `content delete r4-free`，cache verified；级联清理43根+1回复及其点赞，无媒体需删除。之后按两个自建用户ID清理46条通知（reader44 + actor两条真实根点赞通知）、5会话、2验证记录、2用户；自建两个cache event verified回执保留后删除。没有创建权益/码/兑换。
- Mailpit只删除两封自身验证码邮件，删除200、剩余自身邮件0；三个/tmp文件（秘密、浏览器会话、非秘密旧快照）及临时发布源删除。
- 原清理验证查询写成 `LIKE 'a4%'`，误把旧cmt随机UUID `a4104193-…` 及其一条点赞统计进去，故原回执显示FAIL；**该旧行从未删除**。立刻仅只读收窄为本轮精确UUID命名空间，结果自身评论/点赞/通知全0；证明误匹配仍为cmt-free/count1/likes1。原失败回执保留，解释及正确查询在 `cleanup-scope-correction.txt`。不是重新删除数据或把清理失败隐藏。
- cmt两作品status/visibility、48条旧评论的ID/body/like_count/deleted_at、acc三用户status/role与开始快照精确相同。未向旧数据发送互动写请求。
- 最终自身内容/用户/会话/邮件验证/通知/评论/点赞/分析/缓存事件剩余0；作品Web、API、policy均404。清理证据：`cleanup-before.txt`、`cleanup-cli.txt`、`cleanup-sql-mail.txt`、`cleanup-scope-correction.txt`、`cleanup-web.txt`。
- 只写本运行目录报告、脱敏txt回执与截图；无固定套件/harness/可执行脚本入库、无实现或历史工件修改、无staged files。没有重跑typecheck/build：代码冻结且本任务限现场三项，既有生产构建由任务指定；不以构建通过替代业务验收。
- 提交工件前做文本脱敏/隐藏文件/写入范围检查及秘密临时文件不存在核对，见`final-safety-check.txt`。最终`SHA256SUMS.txt`索引全部报告/证据，生成后不再编辑索引内文件。

## 未覆盖与交接

- C点击后原页面的已读DOM、PATCH响应正文未取得；SQL+真实PATCH+服务日志证实终态。工具错误不是业务FAIL，也不是完整浏览器点击后可见性PASS。
- A旧40条后的游标字符串来自透明标注的只读补查询，而非原第二页响应body；实际旧UI闭包拒绝及新首页游标使用均是现场直接证据。
- 单机单Chromium桌面headless、短受控竞态；不涵盖其他浏览器/移动端、无限网络挂起、大压力、任意组合竞态。503为明确客户端故障注入，未实际宕机。
- 不扩大为r2/r3回归、认证安全矩阵、付费权限/锁/迁移、锚点完整性均重新验收；这轮没有重复这些已完成项目。

下一步：主agent/独立reviewer核对本轮证据与实现评审，尤其核对上述证据缺口和A泛化提示残留；本报告不单独授权合并。
