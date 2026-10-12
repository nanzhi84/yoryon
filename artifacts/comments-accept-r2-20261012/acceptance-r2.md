# Issue #14 评论修复提交 98f04c7 — 第二轮独立验收报告

- 运行名：comments-accept-r2-20261012
- 工作树：/Users/yoryon/Projects/yoryon-pr3-comments，commit 98f04c7（`fix(review): GPT 6.1 评审发现修复（9 major + 7 minor）`）
- 验收人：独立验收子 agent（未修改仓库代码；`git status` 仅新增本工件目录）
- 时间：2026-10-12（UTC 15:05–15:15）
- 基线：第一轮 A–L 全部 PASS（artifacts/comments-accept-20261012/），数据（cmt-free/cmt-paid、acc_u1/u2/u3、评论/通知）保留

## 环境与数据前提

- API：http://127.0.0.1:4323（tsx 直跑本工作树 `apps/api/src/index.ts`）；行为确认运行的是修复后代码（`locate` 端点存在，旧代码无此路由）
- Web：http://localhost:3103（新生产构建）；DB：localhost:54329/yoryon_accept_comments；Mailpit：11126
- **会话获取方式（环境限制绕行，已脱敏）**：本轮矩阵不含认证流程。密码重置取 token 的真实路径被环境 DNS 劫持阻断（API 进程内 `localhost`→219.153.42.238，SMTP 11125 ETIMEDOUT → 4 次 500，与第一轮记录的同一环境问题；env.sh 的 `MAIL_SMTP_HOST=localhost`，第一轮曾以 127.0.0.1 重启规避，本轮重启后复原）。为避免改动主 agent 已重建的环境，改用与第一轮 C4 同类的 SQL 数据前置：按 `generateSessionToken` 同款算法（随机 32B base64url + sha256 存 `sessions.token_hash`）为 acc_u1/u2/u3 各插入一条 30 天会话，`GET /api/auth/me` 逐一验通。token 仅存内存，不进工件。
- 测试 4 需要 cmt-paid 互动权益：经真实 CLI 路径 `pnpm cli entitlement grant --user acc_u2 --scope content:cmt-paid`（系统激活码 + 同一兑换路径）授予 U2。
- 数据未删除；未触碰其他端口/库。

## 逐项结果

### 1. 点赞计数真值 — PASS

- U1 发根评论 `fdfd5771`（T1-target-comment.json）；U3 先串行点赞一次（count=1）
- U2 并发 5× PUT like：全部 200，响应均 `{"ok":true,"likeCount":2}`；SQL `like_count=2`、`comment_likes` 2 行（T1-after-puts.sql.txt）——响应计数与 DB 真值一致
- U2 并发 5× DELETE like：全部 200，响应均 `likeCount:1`；SQL `like_count=1`、likes 1 行；再补 1 次未赞状态 DELETE → 200 `likeCount:1`，计数非负（T1-concurrent-deletes.txt）

### 2. 互动/删除串行化 — PASS

- **删除 vs 点赞（删除先发，T2A）**：1× DELETE 200 + 4× 409 `already_deleted`；5× PUT like 全部 404 `评论不存在或已删除`；终态 deleted=t、like_count=0、likes 0 行；无 500
- **点赞 vs 删除（点赞先发，T2B）**：2× PUT 200 `likeCount:1`（同用户幂等）+ 3× 404；1× DELETE 200 + 4× 409；终态 deleted=t、like_count=1、likes 1 行、`like_after_delete=f`（无删除后计数增加）；属任务允许的"点赞成功且删除成功"终态；无 500
- **回复 vs 删除目标（T2C）**：1× 回复 200（created 15:06:46.061 < 目标 deleted 15:06:46.066）+ 4× 400 `reply_target_invalid`；1× DELETE 200 + 4× 409；SQL `reply_after_delete=f`（无对已删除评论的新回复）；无 500

### 3. 通知幂等键 — PASS

- U2 对 U1 评论 `780ca546` like→unlike→like：U1 的 like 通知恰 1 条；`event_id=24bd3268-…` 与本地按 `like:<commentId>:<actorId>` sha256 派生 UUID（v5 位）独立计算结果**逐字符一致**（T3-like-idempotency.txt）
- U2 两条回复 → 2 条独立 reply 通知，`event_id` 分别与 `reply:<commentId>` 推导值一致、互不相同

### 4. 通知投影 — PASS

- 前置：CLI 授予 U2 cmt-paid 权益；U3(admin) 在 cmt-paid 发评论 `94e07680`；U2 点赞 → U3 通知 `link=/p/cmt-paid#comment-94e07680…`、`contentTitle=评论验收·付费文`（T4-before-unpublish.json）
- `pnpm cli unpublish cmt-paid` → 200（T4-unpublish.txt）后：同一条通知 `link=null`、`contentTitle=null`（T4-while-unpublished.json）
- `pnpm cli publish <abs>/posts/paid-post` 重新发布后：link/contentTitle 恢复原值（T4-after-republish.json）；cmt-paid 评论列表恢复 200
- 注：首次 publish 用相对路径 `posts/paid-post` 因 cwd 在仓库根而失败（Exit 1），改绝对路径成功；不影响结论

### 5. replyTo 已删除显示 — PASS

- U1 评论 `dc7a207d`，U2 回复之；删除前 `replyTo.username="acc_u1"`（T5-before-delete.json）
- U1 删除自己该评论（200）后，GET 回复列表 200，U2 回复 `replyTo.username=null`（T5-after-delete.json）

### 6. 锚点定位 — PASS

- 回复 id locate → `{"rootId":"dc7a207d-…","contentSlug":"cmt-free"}` 200
- 根评论 id locate → `rootId=自身` 200
- 未发布内容（cmt-paid 取消发布窗口内）的评论 locate → 404 `内容不存在`（T6-locate-unpublished.txt）
- 不存在的合法 UUID / 36 连字符 / `%7Bbad%7D` → 均 404 `评论不存在`，无 500（T6-locate.txt）

### 7. 校验收紧 — PASS

16 项乱 id/乱游标请求全部 400/404、无 500（T7-validation.txt）：根游标 `{bad}` / likeCount=-1 / 坏日期 → 400 `invalid_cursor`；replies 36 连字符与 `{bad}` → 404；回复游标 `{bad}` → 400；PUT/DELETE like、DELETE 评论乱 id → 404；POST replyToId 乱值 → 400 `invalid_request`；PATCH 通知已读乱 id → 404；通知游标 `{bad}` → 400；liked ids 非 UUID / 101 个 id → 400。
API 日志全量复核：117 条请求中 5xx 恰 4 条，均为本会话开头密码重置的 SMTP 环境问题（`connect ETIMEDOUT 219.153.42.238:11125`），T7 窗口内 0 条 5xx、0 条 unhandled error。

### 8. 前端行为 — PASS（浏览器点击交互 UNVERIFIED）

- `curl http://localhost:3103/p/cmt-free` → 200（15910 字节，T8-page-cmt-free.html）
- 评论区客户端 bundle（`app/render/[revision]/[slug]/page-41f4f50068c13015.js`）含锚点定位逻辑：`comments/".concat(l,"/locate`、`#comment-`、`location.hash`、`rootId`、`contentSlug`、`getElementById`、`scrollIntoView`（T8-bundle-grep.txt）
- 通知铃铛：站点 chunk `59-da2b51e19b2e59a7.js` 含 `unread-count` 拉取与 `/notifications` 链接；经 BFF 带会话 Cookie `GET /api/notifications/unread-count` → 200 `{"count":8}`（铃铛将渲染角标），匿名 → 401（按组件逻辑不渲染入口）（T8-bff-bell.txt；组件源码 notification-bell.tsx 仅登录渲染）
- **浏览器点击级交互 UNVERIFIED**：本子 agent 无浏览器工具；锚点定位链路以 bundle 字节 + locate 端点真实响应覆盖，铃铛以同源 BFF 路径覆盖

### 9. 回归抽查 — PASS

- 游客 GET cmt-free 评论列表 200
- U1（第一轮已撤销 cmt-paid 权益）POST cmt-paid 评论 → 403 `forbidden 当前没有该作品的互动权益`
- 根列表翻页：2 页共 38 条根评论、38 distinct 无重复无遗漏，likeCount DESC → created_at DESC → id DESC 全序逐对校验无违例（T9-regression.txt）
- U1 未读数 API `{"count":8}` 与 SQL `count(*) where read_at is null`=8 一致

### 10. HEAD 请求 — PASS

- `curl -I /api/contents/cmt-free/comments`（匿名与带 Bearer）：200，`cache-control: public, max-age=0, must-revalidate`，响应头**无 x-session-expires**（T10-head-anon.txt / T10-head-auth.txt）
- 不触发续期/触点实证：预置 `last_used_at=now()-2h`（超过 60s touch 阈值），带 Bearer 的 HEAD 后 last_used_at 不变；对照 `GET /api/auth/me` 同 token 后 last_used_at 立即刷新——且仅被用的那条会话被 touch（同用户另一条会话保持旧值），证明 HEAD 走了公开线、完全未进入会话查询
- 带 Bearer 的 HEAD `/api/comments/<id>/replies` 与 `/locate` 同样无 x-session-expires、不 touch 会话

## 结论

修复点 1–10 全部 PASS（第 8 项中浏览器点击交互因无浏览器工具为 UNVERIFIED，与第一轮口径一致，已用 bundle 字节 + 同源 HTTP 路径覆盖）。未发现修复引入的回归。

## 未覆盖项 / 备注

1. 浏览器端真实滚动/展开/翻页交互未执行（无浏览器工具）。
2. 环境脆弱性复发：API 进程内 `localhost` 被解析到 219.153.42.238（DNS 劫持）导致 SMTP 发信 500（本轮 4 次，全部为密码重置探测）；env.sh 的 `MAIL_SMTP_HOST=localhost` 在此机器上不可用，第一轮以 `127.0.0.1` 重启规避。建议主 agent 知悉并把 env 固定为 127.0.0.1。
3. 本轮经 SQL 前置了 3 条会话与 1 条 CLI 授予的权益（U2→cmt-paid），数据按任务要求保留未删。
4. 并发竞态用 shell `&` 发起（10 并发量级），验证了锁串行化语义；未做更高压的负载测试。

## 证据索引

`evidence/` 下按 T1–T10 编号存放：HTTP 响应原文、SQL 回执、CLI 输出、页面 HTML 与 bundle 特征串统计。已扫描确认不含 token/密码（会话 token 仅存内存变量；工件中的 id 均为业务 UUID）。
