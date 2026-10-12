# 本轮独立现场操作记录

本文件是命令与用户操作回执索引，不是可执行测试套件。工作目录 `/Users/yoryon/Projects/yoryon-pr4-member`。仅使用 localhost PostgreSQL 54320 的专用库 `yoryon_member_20261013`、FS `/tmp/yoryon-member-20261013/storage`、API 4160、Web 3160、Mailpit SMTP 11125 / HTTP 11126。凭据只存在 chmod 600 的临时配置与私有文件，不写入工件。所有新账号为本轮 `mr15_*@accept.invalid`。

## 配置与工程检查

```text
git rev-parse HEAD
git rev-parse HEAD^{tree}
git diff 61f1296 HEAD --name-only      # 初次 main 整合的树等价
git diff 864a0874 HEAD --stat         # 后续修复的准确差量
source /tmp/yoryon-member-20261013/env.sh
pnpm typecheck
pnpm cli cache retry
```

隔离库由交付代理从空库执行 `pnpm db:migrate` 至 0009。首次缓存配置缺失，主导服务的代理补齐本地回调与随机 secret 后，本人实际执行 cache retry；6 个事件最终 verified。真实浏览器和 Origin 统一 `http://127.0.0.1:3160`。为真实注册 20 个新增分页账号，服务代理把隔离 RATE_LIMIT_SCALE 从 8 调至 100 并重启 API；源码未增加验收钩子。构建由服务代理执行 `pnpm build`，本人只读其冻结版本回执并复验运行 bundle，未覆盖共享 `.next`。

## 作品与权益 CLI

```text
node apps/cli/dist/index.js collection create mr15-mixed --title MR15混合合集 --visibility paid
node apps/cli/dist/index.js publish /tmp/mr15-posts/mr15-intro
node apps/cli/dist/index.js publish /tmp/mr15-posts/mr15-free
node apps/cli/dist/index.js publish /tmp/mr15-posts/mr15-paid
node apps/cli/dist/index.js collection sort mr15-mixed mr15-intro mr15-free mr15-paid
node apps/cli/dist/index.js content pin mr15-intro
node apps/cli/dist/index.js user promote mr15_admin
node apps/cli/dist/index.js entitlement grant --user mr15_actor --scope subscription --days 30 --reason mr15_review
node apps/cli/dist/index.js entitlement grant --user mr15_actor --scope subscription --days 30 --reason mr15_renewal
node apps/cli/dist/index.js entitlement grant --user mr15_reader --scope content:mr15-paid --reason mr15_content_only
node apps/cli/dist/index.js entitlement grant --user mr15_reader --scope collection:mr15-mixed --reason mr15_collection_only
node apps/cli/dist/index.js code create --grant-type subscription --days 30 --count 1 --max-uses 30 --note mr15_owned_review
node apps/cli/dist/index.js question list --status pending
node apps/cli/dist/index.js question answer 983847a3-9d67-4d73-a660-1f9d1b38f4e5 --file /tmp/mr15-answer-public.txt --by mr15_admin
node apps/cli/dist/index.js question answer 98ea171f-0529-4fbf-b130-4da63cef2c9e --file /tmp/mr15-answer-private.txt --by mr15_admin
node apps/cli/dist/index.js question hide 983847a3-9d67-4d73-a660-1f9d1b38f4e5
node apps/cli/dist/index.js entitlement revoke <本轮当前 subscription ID> --reason 'MR15 isolated revoked' --by mr15_admin
node apps/cli/dist/index.js media gc
node apps/cli/dist/index.js media gc --apply
```

激活码 stdout 在私有进程内捕获，未打印；CLI授予回执、回答通知幂等回执见 cli-grants.json / cli-answers.json。重复回答的实际回执为 notification unchanged，SQL 与通知读取确认没有第二条回答事件。

## 真实 API / BFF 用户路径

所有 POST/PATCH/PUT/DELETE 带 canonical Origin。浏览器 Cookie 仅供本轮自有账号，API路径使用对应 Bearer；这些值不出现在工件。现场 Node here-document 直接发请求、读取 Mailpit 与查询 SQL，不落可执行断言程序。

```text
POST /api/auth/register {username,email,password}
GET  http://127.0.0.1:11126/api/v1/messages
GET  http://127.0.0.1:11126/api/v1/message/<本轮确切收件人邮件 ID>
POST /api/auth/verify-email {email,code}
POST /api/auth/login {identifier,password}
POST /api/redemptions {code}
GET  /api/me/membership
POST /api/questions {question,visibility}     # 默认公开；另一路 private
GET  /api/questions/public[?cursor=...]
GET  /api/questions/mine
GET  /api/questions/<own/other ID>
PATCH /api/questions/<own ID> {visibility}
POST /api/questions/<ID>/comments {body,replyToId?}
GET  /api/questions/<ID>/comments
GET  /api/comments/<root ID>/replies
GET  /api/comments/<reply ID>/locate
PUT / DELETE /api/comments/<ID>/like
GET  /api/comments/liked?ids=<own ID>
GET  /api/notifications
PATCH /api/me/profile {displayName}
GET  /api/users/<own/other ID>/profile
POST /api/me/avatar  image/png|image/jpeg|image/webp 原始图片字节
DELETE /api/me/avatar
GET /api/avatars/<asset ID>       # 读取真实字节，sharp.metadata / SHA256
```

先真实创建 4 个账户，后新增 20 个真实注册、邮箱验证、激活码兑换及默认公开提问，全部通过 BFF，未直接 INSERT 用户/权益/问题。分页不是固定 fixture：每条问题由当次服务生成 UUID/时间，比较浏览器实际 ID 和当次 SQL 行集合。

同一会员两次并发 `POST /questions` 得到 201 与 409，SQL user/month 只有一行。续订后再次读取次数仍 0。私密、公开、隐藏及撤销前后分别使用匿名、有效会员、单项权益用户、本人、管理员读取 API 与 SSR HTML，检查本轮回答标记是否存在。公开讨论上下文和通用 replies/locate/liked 均核对权限。

## 内置浏览器用户操作

实际点击：首页、订阅、探索、合集、标签、资料、通知。会员 CTA → 未登录兑换提示 → LoginForm → RedeemForm → `/subscription#membership`。真实填写问题、展示名，上传本轮图片文件，提交根评论、回复、点赞。点击回复通知后定位到 `#comment-...` 并展开根评论的真实回复。外站 `returnTo=//outside.invalid/escape` 登录后返回站内 `/`。

问答第一页 20 条时，另一个实际 API 点赞产生最近活动；旧页游标返回 409，页面显示“问答有新活动，请刷新列表”，点击刷新后继续载入末页，总共 21 个唯一 ID，与实际 SQL 集合相同。另用 CDP 仅拦截本地非 Document `Fetch /api/questions/public`、注入一次 ConnectionFailed，页面错误 → 刷新 → 实际问题列表恢复；结束通过 `Fetch.enable {patterns:[]}` 清除所有本轮拦截。

## SQL 与媒体故障前提

```sql
SELECT id,user_id,month_key,visibility,status FROM member_questions ORDER BY id;
SELECT user_id,month_key,count(*) FROM member_questions GROUP BY user_id,month_key HAVING count(*)>1;
SELECT slug,visibility,type,is_pinned FROM contents WHERE is_pinned;
SELECT state,count(*) FROM cache_events GROUP BY state;
SELECT id,oss_key FROM media_assets WHERE id = ANY(<本轮 avatar UUID 数组>);
SELECT pg_advisory_lock(hashtextextended('yoryon.media_publish_gc',0));
SELECT pg_advisory_unlock(hashtextextended('yoryon.media_publish_gc',0));
```

年龄/时间故障仅改变本轮独占的资产或权益：当前 avatar资产 created_at 设为9天前以跨过GC7天宽限，实际引用保留；解除引用后 dry-run 与 apply 删除对应资产。会员到期场景将自己的 subscription valid_until 设至刚过去，之后走实际 API / UI，未改变服务时钟。

为验证失败上传的孤儿回收，在独立 SQL 事务持有本轮 admin user 行锁，正常 API 上传新的绿色 PNG；服务的5秒锁超时导致500，存储出现1个对象、数据库0行。解除锁，把这个真实失败留下的对象 mtime 设置为30小时前，实际 CLI dry-run发现孤儿，apply删除，当前两个头像引用保留。

月界仅以项目实际导出 `monthKeyShanghai` 检查四个上海月底前后一毫秒 Date，使用 `node --import tsx --input-type=module`。没有推进真实服务时钟，因此真实跨月端到端保持 UNVERIFIED。

## 本轮操作错误与更正

- 初次查看包把 source-only core 当作 dist 导入，ERR_MODULE_NOT_FOUND；在任何数据库写入前失败，改为 tsx 导入源码导出。
- Web维护重建期间一次BFF调用 ECONNREFUSED，未发生业务写；继续使用同源码隔离API，Web重启后复验。
- CDP首次未指定非 Document resourceType 被工具拒绝，随后指定 Fetch；一次REPL变量未定义，在后续调用恢复。Fetch.disable被宿主拒绝，按工具提示用 Fetch.enable 空 patterns 清除，真实错误/重试已留证。
- 初次头像像素探查遭通配32KiB限制，413不能证明像素限制。另发送15679字节、16004000像素PNG，实际400 invalid_image；原失败保留并推动修复通配边界。
- 最终权限矩阵曾因使用recipient_id而不是recipient_user_id，在后续SELECT阶段失败；前面的CLI回答/隔离时间前提已完成，局部回执未保存。按实际schema重跑全部最终矩阵及幂等回答和SQL，artifact明确披露。
- 清理初次只读收集code ID时误用activation_code_id，在BEGIN及任何删除之前失败；按schema改为code_id后完整事务成功、全表计数和基线哈希复核。
- 最终ProfileForm复验首次选择错误label未打开文件选择器，工具超时重置会话；重新绑定本轮原标签，用实际input[type=file]完成上传。最初等待的“头像已更新”非实际回执，改读真实“个人资料已保存”和已加载320px图，未将等待超时记成产品失败。

最终大小边界通过API和BFF各自现场流式Readable请求，不传Content-Length：原JPEG166517字节200；同JPEG附加零尾部至恰好2MiB仍可解码并200，+1字节413。问题无效参数JSON加空白至32768字节400，32769字节413；讨论POST超32768字节413。原始JPEG/PNG、临时作品和回答保留于historical-inputs，只供历史字节/源文件核对，不能当成当前固定测试入口。
