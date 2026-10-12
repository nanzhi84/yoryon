# Issue #14 评论/回复/点赞/站内通知 — 独立验收报告

- 运行名：comments-accept-20261012
- 工作树：/Users/yoryon/Projects/yoryon-pr3-comments，commit e4a9b0f（`feat: 文章评论、回复、点赞与站内通知（Issue #14）`）
- 验收人：独立验收子 agent（未修改仓库代码）
- 时间：2026-10-12（UTC）

## 环境与数据前提

- API：http://127.0.0.1:4323（tsx 直连本工作树 `apps/api/src/index.ts`，Bearer token）
- Web：http://localhost:3103（Next 15.5.27 生产构建，BFF 同源，Cookie 会话）
- DB：隔离库 `yoryon_accept_comments`（localhost:54329）
- Mailpit：SMTP 11125 / HTTP 11126
- 内容：`cmt-free`（public）、`cmt-paid`（paid，preview 30%，付费区标记 PAIDBODY-CMT-9z2x）
- 测试账号（Mailpit 验证码注册）：acc_u1 / acc_u2 / acc_u3（acc-u*@test.local）；acc_u3 后经 `pnpm cli user promote` 升为 admin
- **环境修复记录**：原 API 进程带 `HTTP(S)_PROXY` 且运行中把 `localhost` 解析到 219.153.42.238（DNS 劫持），注册发信 `connect ETIMEDOUT 219.153.42.238:11125` → 500。以相同 env 仅改 `MAIL_SMTP_HOST=127.0.0.1` 重启 API（同一工作树同一代码，tsx 直跑），Web(3103) 未动。重启后注册/发信正常。原始报错见 /tmp/yoryon-accept-comments/api.log。
- 数据保留：验收数据未删除（任务要求）。

## 逐项结果

### A. 游客 — PASS
- GET /api/contents/cmt-free/comments → 200 `{"items":[],"total":0,"nextCursor":null}`（evidence/A1-list.json）
- POST 评论 / PUT like / DELETE 评论 / GET /api/notifications → 均 401 `unauthorized`（命令输出见会话记录；A 项 curl 逐条 401）
- 响应头 `cache-control: public, max-age=0, must-revalidate`（evidence/A1-headers.txt）

### B. 注册用户无权益 — PASS
- U1 在 cmt-free 评论 200（evidence/B1）、回复 200（B2）、点赞 200 `{"ok":true,"likeCount":1}`（B3）
- U1/U2 在 cmt-paid POST 评论 → 403 `forbidden 当前没有该作品的互动权益`（B4、B7）
- U2 对 cmt-paid 已有评论 PUT like → 403（B5）
- 匿名 GET cmt-paid 评论列表 → 200 可读（B6，200）

### C. 兑换订阅与撤销 — PASS
- U1 兑换激活码 NVXW-…-CBAX → 200，entitlement d244fe51…（C1）
- 兑换后 cmt-paid 评论 200、点赞 200（C2、C3）
- SQL `UPDATE entitlements SET revoked_at=now()`（C4）后：POST 评论 403、PUT like 403、DELETE like 也 403（C5、C6，即时生效无缓存残留）
- 撤销后匿名 GET 列表仍可见既有评论（C7）

### D. 排序与分页 — PASS
- 24 条根评论（U1/U2/U3 轮流）+ 计划化点赞（第 i 条 i%4 个赞）+ 此前 B1 root（1 赞）= 25 条根
- 游标翻页：page1=20 条、page2=5 条、末页 nextCursor=null；抓取 25 条 distinct 25，无重复无遗漏，total=25（D-pagination.txt）
- 排序逐对校验 likeCount DESC → created_at(ms) DESC → id DESC：无违例（D-pagination.txt "ordering OK"）
- 每条 likeCount 与计划一致（D-likecounts.txt "mismatches: none"）
- 回复按时间正序：见 E3（replies 接口 createdAt 升序）

### E. 回复 — PASS
- U2 回复 U1 根评论 200，parentId=根 id（E1）
- U3 回复 U2 的回复 → parentId 仍为根 id（扁平化），其 replyTo={id:U2回复id, username:"acc_u2"}（E2、E3）
- replyToId 用 cmt-paid 的评论 id（跨内容）→ 400 `reply_target_invalid`（E4）
- 对已删除评论回复 → 400 `reply_target_invalid`（E5）
- UI 契约 replyTo.username 存在（E3 每条均含 username；目标为根时 username=根作者）

### F. 点赞 — PASS
- U2 重复 PUT like 两次 → 均 `{"ok":true,"likeCount":1}`（幂等）
- U3 同一评论 5 个并发 PUT → 全部 200 且 likeCount=2（U2+U3），SQL 核对 comment_likes 每用户仅 1 行、comments.like_count=2（F3-likes.sql.txt）
- U2 DELETE 取消 → likeCount=1；重复 DELETE → 仍 200 likeCount=1，计数不为负（F3 末段）

### G. 通知 — PASS
- U2 回复 U1 根评论 → U1 通知含 `type=reply, actor=acc_u2, link=/p/cmt-free#comment-32a70271-…, contentTitle, commentId`（G1 中 id=5e5cbcd8）
- U3 点赞 U1 根评论 → `type=like, actor=acc_u3, link=/p/cmt-free#comment-b6b9c1a0-…`（G3-like-notif.json）
- U1 自回复、自点赞均不产生通知（G1 全部 11 条 actor 均为 acc_u2/acc_u3，无 acc_u1）
- unread-count：11（G3 后）→ PATCH 已读一条后 10 → read-all 后 0（G2/G7/G8）
- PATCH 已读幂等：两次均 200 `{"ok":true}`（G5）
- U2 PATCH U1 的通知 → 404 `not_found`（G6）

### H. 删除 — PASS
- U1 删自己 → 200（H1）；U1 删 U2 评论 → 403 `只能删除自己的评论`（H2）
- admin（promote 后的 U3）删 U2 评论 → 200（H3/H3b）
- 软删除占位：根列表中 deleted=true, body=null, author=null, replyCount 保留（H4b 三条均符合）
- 已删根评论的回复列表仍 200 可见（H4c）
- 已删评论 PUT like → 404 `评论不存在或已删除`（H5）

### I. 未发布内容 — PASS
- `pnpm cli unpublish cmt-free`（I1）后：GET 评论列表 404（I2）、POST 404（I3）、replies 404（I4 输出）
- `pnpm cli publish posts/free-post` 重新发布后：列表 200、total=29 历史评论完整（I5、I6），Web /p/cmt-free 恢复 200

### J. 安全 — PASS
- body 含 `<script>alert(1)</script>` 与 `<b>`：API 200 接收、DB 原样存储（J1b）；curl /p/cmt-free HTML 中 0 处未转义 `<script>alert(1)</script>`（评论区为客户端渲染，HTML 本不含评论体）；渲染组件 `CommentBody` 为 React 文本插值 `{text}`（自动转义），apps/web 仅 render/layout 两处 dangerouslySetInnerHTML 与评论无关
- 跨站 Origin（https://evil.example.com）POST 经 BFF :3103 → 403 `csrf_rejected`（J5）；同源 Origin 无会话 → 401 而非 csrf（对照）
- body 2001 码点 → 400 `invalid_body 评论需为 1-2000 字纯文本`（J3）；恰好 2000 码点 → 200（边界）
- 空 body → 400；纯空白 body → 400（J4）

### K. 公开线纯净 — PASS
- 全部捕获的列表/回复响应无 email 等私有字段（grep evidence 无 email；DTO 仅 username）
- 响应头 `cache-control: public, max-age=0, must-revalidate`（A1-headers.txt）
- 匿名 vs 登录（U1 Bearer）GET 列表字节级 IDENTICAL；replies 端点同样 IDENTICAL（K3/K3b）

### L. Web 页面 — PASS（浏览器交互 UNVERIFIED）
- curl http://localhost:3103/p/cmt-free → 200（J2 页面存档）
- BFF 登录（emailOrUsername+password）→ Set-Cookie yoryon_session；带会话 GET /notifications → 200，`<title>通知 · Yoryon</title>`（L2）
- 站点头部含 NotificationBell 组件（apps/web/components/site-header.tsx:3,21）
- 经 BFF Cookie 会话 POST 评论（与浏览器同源同路径）→ 200 且该评论出现在公开列表（L6 + 翻页核对）
- 匿名与无权益 U1 访问 /p/cmt-paid：付费区标记 PAIDBODY-CMT-9z2x 均 0 匹配（未泄漏）
- **浏览器点击级交互（输入→提交→即时显示）UNVERIFIED**：本子 agent 工具白名单无浏览器工具；已用 BFF Cookie 会话 HTTP 路径（与浏览器完全同源同接口）覆盖提交→可见链路，并以源码核对渲染转义。

## 结论

矩阵 A–K 全部 PASS；L 除浏览器点击交互（工具不可用，已用等价 HTTP/BFF 路径 + 源码核对覆盖）外 PASS。未发现缺陷。

## 未覆盖项 / 备注

1. 浏览器端真实点击/渲染交互未执行（无浏览器工具）。
2. 回复列表（replies）自身的翻页未造 21+ 回复压测（矩阵仅要求根评论翻页与回复正序，均已覆盖）。
3. 通知列表分页（nextCursor）未压测（仅 11 条，单页）。
4. 撤销权益后连「取消点赞」也被 403 拒绝（既有 like 记录残留但计数一致）；属产品语义，记录供知晓，非矩阵判负项。
5. API 进程曾因本机 DNS 劫持 + 代理环境变量导致 SMTP 连接失败，以 MAIL_SMTP_HOST=127.0.0.1 重启恢复（同代码）；建议主 agent 知悉该环境脆弱性。

## 证据索引

evidence/ 下按矩阵编号存放：HTTP 响应原文（JSON/headers）、SQL 回执、CLI 输出、页面 HTML。不含 token/密码/邮件正文全文（K3 文件中 "eyJ…" 为公开分页游标 base64url，含 likeCount/时间戳/评论 id，非凭据）。
