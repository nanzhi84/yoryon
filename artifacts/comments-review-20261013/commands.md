# 本轮实际操作回执索引与重做前提

固定 head/base 和环境见 README / environment.json。本文件保留临时操作说明，不是可执行验收程序。重做时为新 run 创建新的 `accept.invalid` 用户、slug、私密 0600 文件；生成当前 SQL 序列作为比较依据，不复用本轮固定 ID/数量作为预期。使用内置 IAB 新标签，API 请求只指向下列 localhost 地址。

| 操作 | 实际命令/接口与工具 | 工件 |
|---|---|---|
| 源码版本 | `git rev-parse HEAD`；`gh pr view 20 --json headRefOid,baseRefOid,url`；`git diff --name-only 24000316eb49dfdc9f66f4f3688b257a037eadda...HEAD` | README/source-sha256.json |
| 基线 | `source /tmp/yoryon-accept-comments/env.sh`；一次性 Node `pg.Client`，URL 必须 localhost:54329/yoryon_accept_comments；对九个表 `SELECT row_to_json(t)::text FROM <table> t ORDER BY row_to_json(t)::text`，行以 `\n` 连接取 SHA256 | environment.json |
| 两个自有用户 | Node fetch 真实 BFF `POST /api/auth/register`，只用 accept.invalid 自有邮箱；只取对应本地 Mailpit 消息的验证码，`POST /api/auth/verify-email`，Cookie 放 /tmp 私密文件；IAB LoginForm 再实际登录 | auth-and-roots.json |
| 自有作品 | `source /tmp/yoryon-accept-comments/env.sh`；`node apps/cli/dist/index.js publish /tmp/cmr14-post`，目录 index.md 使用 title/slug/visibility/preview Front Matter 与自身标记正文 | publish.txt |
| 创建跨页讨论 | Node fetch BFF `POST /api/contents/cmr14-review/comments`，JSON `{body}`，Cookie+Origin localhost:3103。浏览器输入正文→发送→观察 DOM。第二用户回复→发送→点赞 | auth-and-roots / browser-ui-*.json |
| 双并发/外部点赞 | `Promise.all` 两次 `PUT /api/comments/<自身目标>/like`；SQL 点赞/通知/version；保留原游标 GET 后续页，浏览器点击加载更多 | external-like-stale / browser-stale-*.json |
| 恢复失败 | CUA CDP `Fetch.enable` 只匹配自身根 GET，explicit resourceType Fetch；实际 409 后恢复 GET 被暂停，用 `Fetch.fulfillRequest` 一次 503；`Fetch.enable {patterns:[]}` 清除，点击真实重试 | browser-reset-*.json |
| 通知已读 | 真实 LoginForm 作者→notifications，实际点击单条和全部已读；SQL `notifications WHERE recipient_user_id=$1`；另一用户 PATCH 原作者 notification ID | browser-notifications / notifications-sql-boundary.json |
| 会话/迟到计数 | CUA CDP Network.getCookies 仅读取此 localhost 自有会话且不输出；Fetch response-stage暂停 count 200；Node BFF `POST /api/auth/logout` 用该 cookie；me/count 401；清规则，页面导航，旧请求已取消 | logout / browser-logout-late-count.json |
| 流式上限 | Node `ReadableStream` + fetch `duplex:'half'`，JSON `{body:'',padding:'x…'}` 精确构造 32768/32769 bytes，每块最多4096，无 Content-Length，分别 API4323 Bearer 和 BFF3103 Cookie+Origin | chunked-body-boundary.json |
| 付费/授予/撤销 | 修改自身 index.md `visibility: paid`, `preview.mode: none` 再 publish；`node apps/cli/dist/index.js entitlement grant --user cmr14_actor --scope content:cmr14-review --reason cmr14_isolated_review`；`node apps/cli/dist/index.js entitlement revoke 0c9c3cde-3e39-401f-88ca-a37a3ec914ea --reason cmr14_isolated_revocation` | paid-*.json |
| 权限和软删除 | Node真实BFF POST comment `{body,replyToId}`、PUT/DELETE like、DELETE comment；SQL查被拒绝正文不存在；匿名浏览器重读、展开删除根回复、完整分页，DOM IDs 对独立 SQL 排序 | paid-revocation-soft-delete / browser-paid-soft-delete / browser-sql-complete-sequence.json |
| 静态 | `pnpm typecheck > /Users/yoryon/Projects/yoryon/artifacts/comments-review-20261013/typecheck.txt 2>&1`；exit0 | typecheck.txt |
| 清理 | 自身 UUID/slug 条件 SQL 单事务；按九类同样序列化重新哈希；Mailpit `DELETE /api/v1/messages` JSON `{IDs:[仅自身两ID]}`；GET各自消息404；Node lstat验证无符号链接后删明确自身秘密文件/目录；IAB close | cleanup / private-file-cleanup.json |

正文与密码/验证码/会话值不输出，敏感环境不写工件。注册与验证可在新 IAB 用户路径重做，不要求临时秘密文件继续存在。本轮临时文件均已清理，共享 API/Web/PG 由交付 agent 继续管理。

## 操作错误保留

本轮 shell 探查曾误用未安装 `postgres`；改用实际 packages/db/node_modules/pg/lib/index.js。一次 SQL 列名误写 kind/recipient_id，校对 schema 后使用 type/recipient_user_id；此前只读没有写入。

自身付费发布第一次误用 preview.mode chars，CLI 拒绝，改成合法 none 后成功。API 首次 parentId 被 strip 为根创建，重做 replyToId 后真实回复提交；该次结果写入错误工作树相对目录失败，随后 SQL 确认，报告不伪造丢失回执。

清理首次事务在 `payload->>` 上报 `operator does not exist: text ->> unknown`，连接终止回滚全部删除。更正为明确自身 cache-event UUID 后整事务提交，九类基线 hash相同。Mailpit 单条 DELETE 返回405，更正为已在项目历史命令确认的批量消息接口，仅自身 IDs，返回200且各自读取404。

logout 第一次仅检验 Max-Age=0 返回false，实际实现使用空 cookie 与1970 Expires；校对源代码并实际重复探查确认空 Cookie+epoch，logout.json 明确记录原 probe 的限制。
