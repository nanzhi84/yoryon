# 独立验收

时间：2026-10-15；基线 HEAD fa61f5c49d245413ab33c271cef243899997f286 加工作区 comment-read.ts 修改。

结论：本次匿名页面问题为已软删除、无回复根评论仍被公开列表返回并计数。生产匿名 context 返回 false/false/null，没有登录串号证据。公开作品评论是公共讨论内容，不按作者仅本人可见。修复后隔离 API 行为 PASS。生产仍是旧行为，未部署。

## 环境与前提

本机 Docker 容器 e2e-postgres-1，宿主端口 54329；新建独占数据库 yoryon_accept_visibility_1015，未使用项目 .env，API :4186，fs 存储 /tmp/yoryon-visibility-1015，Mailpit :11125。隔离 active 普通用户 u0/u1、随机临时 session、两篇 published/public 作品 accept-visible/other。session token 仅进程内生成，不保存。未调用发信接口，未写生产数据。

## 实际命令与重现步骤

1. `docker exec e2e-postgres-1 createdb -U postgres yoryon_accept_visibility_1015`
2. `DATABASE_URL=postgres://postgres:postgres@127.0.0.1:54329/yoryon_accept_visibility_1015 pnpm exec tsx apps/api/src/migrate.ts`
3. `NODE_ENV=test PORT=4186 DATABASE_URL=postgres://postgres:postgres@127.0.0.1:54329/yoryon_accept_visibility_1015 BFF_SHARED_SECRET=visibility-local-only FS_STORAGE_ROOT=/tmp/yoryon-visibility-1015 FS_STORAGE_SIGNING_SECRET=visibility-local-only STORAGE_BACKEND=fs MAIL_SMTP_HOST=127.0.0.1 MAIL_SMTP_PORT=11125 pnpm exec tsx apps/api/src/index.ts`
4. 现场 `pnpm exec tsx` stdin 会话使用 pg 参数化 INSERT 建立两个普通 active 用户、随机 token 的 SHA256 session（30天）及两篇 published/public 作品。然后用 fetch 执行以下真实 API 顺序；响应完整保存在 local-api-evidence.json。该会话未落地可执行测试程序。
   - GET `/api/contents/accept-visible/comments/context`，依次匿名、A、B Bearer。
   - A POST `/api/contents/accept-visible/comments`，body 为 `{"body":"empty root"}`，取返回 id。
   - B DELETE `/api/comments/{id}`；匿名 DELETE 同路径；A DELETE 同路径；匿名 GET `/api/contents/accept-visible/comments`。
   - A POST 新根，B POST 同作品 `{"body":"reply remains","replyToId":"根id"}`；A DELETE 根；匿名 GET 根列表与 `/api/comments/{根id}/replies`。
   - B PUT `/api/comments/{回复id}/like`；A、B、匿名各 GET `/api/comments/liked?ids={回复id}`。
   - 匿名 GET `/api/contents/other/comments`；A POST other 评论并携带第一篇回复 id。
5. 分页现场命令：SQL `insert into comments(content_id,user_id,body,created_at) select c.id,u.id,'pagination '||i,now()+i*interval '1 second' from contents c cross join (select id from users limit 1) u cross join generate_series(1,25) i where c.slug='accept-visible'`。匿名读取第一页、以 nextCursor 读第二页，并把相同 cursor 用于 other。再新增一个根后重读旧 cursor。完整响应见 pagination-evidence.json。
6. 生产只读复现：`curl -sS -D production-anonymous-list.headers https://yoryon.com/api/contents/freedom-before-wealth/comments -o production-anonymous-list.json`；context 同理追加 `/context`。产物路径均在本目录。

## 实际结果

- PASS：匿名 authenticated:false/canInteract:false/me:null；A/B context 各自 me.id 不同，均 private,no-store。
- PASS：B 删除 A 评论 403；匿名删除 401；作者删除成功。
- PASS：空根删除后 items:[]/total:0；SQL EXISTS 生成语法与相关根条件经真实 PG 读取成功。
- PASS：有有效回复的删除根保留，正文与作者 null；回复可读。
- PASS：B 点赞后只有 B 的 liked 含回复 id，A/匿名为空；私有 no-store。
- PASS：other 作品不含该线程，跨作品回复 400 reply_target_invalid。
- PASS：26 根分页为20+6，26个唯一 id；跨作品游标400 invalid_cursor；新增根后旧游标409 cursor_stale。
- PASS（源码审查）：认证中间件 session token 哈希查询且限定 active 用户；公共根列表身份无关；删除仅作者/管理员；liked 强制 auth.user.id；BFF fetch cache:no-store。
- UNVERIFIED：浏览器最终可见结果、生产双用户登录、管理员删除、付费权益撤销、生产部署与缓存刷新。
- UNKNOWN：现有生产删除评论来源。只读 DTO 不包含作者；不能据此认定为验收数据。

主 agent 决策保留有任意回复（含全已删除回复）的根结构，本次未改变回复展示或该边界；不将此行为误报为完全删除线程隐藏。
