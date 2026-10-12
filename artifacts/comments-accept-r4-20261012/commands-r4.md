# 第四轮现场命令/回执索引（非执行程序）

业务命令共同前置，实际均加载，未输出env：

```sh
set -a
source /tmp/yoryon-accept-comments/env.sh
set +a
```

临时Node heredoc直接执行，没有保存成仓库脚本、套件或harness。密码/验证码/token/Cookie/数据库连接凭证省略；只保留方法、路径、业务投影、SQL及时间。

| 顺序 | 实际命令/操作 | 回执 | 结果 |
|---|---|---|---|
| 1 | `git status --short; git rev-parse HEAD; git show --stat --oneline e8c0846`；只读本轮三个组件与r3索引 | HEAD e8c0846…；初始tracked/staged为空 | 版本观测 |
| 2 | `node --version; sw_vers; psql "$DATABASE_URL" -X -v ON_ERROR_STOP=1 -c '<环境、created_at精度、迁移计数、r4用户查询>'`；curl Web/API/Mailpit | `00-environment.txt` | 环境可用；只查8条迁移，不执行迁移 |
| 3 | `node --input-type=module <<'NODE'`；真实register/verify-email/login两用户，Mailpit取仅自己的验证码；0600 /tmp存凭证 | `01-auth.txt` | PASS，每步及用户名核对 |
| 4 | `mkdir -p /tmp/r4-publish-source/r4-free; printf ... > .../index.md; pnpm cli publish /tmp/r4-publish-source/r4-free` | `02-publish.txt` | published + cache verified，无媒体 |
| 5 | 一次性Node+pg：保存旧cmt/acc非秘密快照，事务插入43根/1回复/预点赞/43通知；curl作品和policy | `03-data-precondition.txt`（完整SQL） | SQL边界前置完成，Web/policy200 |
| 6 | 一次性Playwright+pg：真实Web登录、加载两页；挂新首页、尝试旧UI分页；放行、全页SQL比对；另一首页503、可见重试、全页SQL比对；0600 /tmp保存会话 | `A-command.txt` / `A-root-generation.txt` / 三截图 | PASS，未重跑r3旧页先发时序 |
| 7 | 一次性Playwright+pg：SQL查已点赞回复，挂真实liked；无关根PUT重载；保留展开；释放liked；下一点击DELETE，查SQL | `B-command.txt` / `B-retained-reply-liked.txt` / 两截图 | PASS，未用同回复本地写掩盖问题 |
| 8 | 一次性Playwright+两条pg连接：轻量POST503+第二页并发；不提交新通知；真实read-all完成→COMMIT→放行→重读首页→完整分页→点击PATCH | `C-command.txt` / `C-authoritative-notifications.txt` / 两截图 | 原命令退出1：PATCH已发后读取响应body遭Protocol error；截至新通知未读的业务观察完整 |
| 9 | `contact_supervisor need_decision`，立即停止C原路径，申请只读SQL及尚未开展GET503边界 | 授权原文摘要见下 | 获准；不重发PATCH、不重跑C已完成序列 |
| 10 | 一次性Node+pg：只读目标read_at；`grep '<own late target UUID>' /tmp/yoryon-accept-comments/api-r3.log` | `C-patch-sql-followup.txt` | SQL已读、真实PATCH方法/时间、现有服务日志200；响应正文UNVERIFIED |
| 11 | 一次性Node fetch：使用A记录的第二页URL只读补查、ID与原DOM后20条逐项核对、保留nextCursor解码 | `A-old-cursor-corroboration.txt` | 旧游标边界root4得到佐证，不声称原响应body、不重跑A |
| 12 | 一次性同Playwright+pg：重置一条自身通知未读；真实POST200+SQL；随后GET503；可见“重试刷新”仅GET；DOM/首页ID/SQL核对 | `C-get-retry-command.txt` / `C-get-only-retry.txt` / 两截图 | PASS，执行此前尚未开展的独立边界 |
| 13 | 打开A、B、C截图，结合DOM、HTTP与SQL独立判定 | `acceptance-r4.md` | B红心→空心、C唯一后提交通知红点、GET503独立重试与恢复可见 |
| 14 | `psql ... -c '<只查r4内容/用户/通知>'`; `pnpm cli content delete r4-free` | `cleanup-before.txt` / `cleanup-cli.txt` | 自建44评论清理、cache verified |
| 15 | 一次性Node+pg：限定自身用户/content/slug清理、Mailpit DELETE两自有ID、unlink三个/tmp文件、删除/tmp发布源；curl已删页面/API/policy | `cleanup-sql-mail.txt` / `cleanup-web.txt` | 清理完成；原LIKE a4%验证查询误匹配旧随机UUID而显示FAIL，原回执保留 |
| 16 | 一次性Node+pg：只读精确UUID命名空间、只读证明误匹配属于旧cmt且仍保留；检查临时文件不存在 | `cleanup-scope-correction.txt` | 最终清理PASS；未再次DELETE、未删除旧行 |
| 17 | 版本/diff/staged/写入范围/文本脱敏/秘密文件不存在检查，生成sha256 | `final-safety-check.txt` / `SHA256SUMS.txt` | 最终安全与hash回执；生成后不编辑被索引文件 |

## 实际浏览器机制与关键控制

现场导入用户指定安装路径；登录表单密码只在内存，不截图登录页、不记录请求头：

```js
import {chromium} from '/Users/yoryon/Projects/yoryon/node_modules/.pnpm/playwright@1.64.0/node_modules/playwright/index.mjs';
chromium.launch({headless:true,args:['--host-resolver-rules=MAP localhost 127.0.0.1']});
// 1200x900 / zh-CN；真实 page.goto('http://localhost:3103/login?returnTo=%2Fp%2Fr4-free')
// getByLabel('邮箱或用户名')、getByLabel('密码',{exact:true})，UI提交登录。
```

A只截获根首页真实响应，**不是**挂已发出的旧分页：

```js
page.route('**/api/contents/r4-free/comments', async route => {
  // armed=hold 时：const response=await route.fetch(); await gate;
  // 保存真实response.json业务body；await route.fulfill({response});
  // armed=503 时仅注入明确503；其他continue。
});
// UI两页40条后，从真实按钮 __reactProps$ 的 onClick 捕获旧闭包至页面内存。
// 根PUT→首页挂起→当前普通按钮不存在→调用旧闭包→网络新增请求为空。
// 放行首页后普通UI分页，独立SQL比较完整ID顺序，而非仅数43。
```

B只截获包含目标回复的第一个真实liked，取得 `{liked:[replyId]}` 后等待gate；UI回复DOM已存在。另一root42的真实PUT带来根首页GET，确认root43与展开线程保留；释放gate后aria-pressed=true，再实际DELETE并查SQL。没有在读挂起时对该回复写。

C真实SQL时序（完整插入与查询见业务txt）：

```sql
BEGIN;
INSERT INTO notifications(id,recipient_user_id,actor_user_id,type,event_id,created_at)
SELECT 'a4200000-0000-4000-8000-000000000099',r.id,a.id,'like',gen_random_uuid(),'2026-10-12 12:01:00.333+00'
FROM users r,users a WHERE r.username='r4_reader' AND a.username='r4_actor'
RETURNING id,created_at,read_at;
-- 不COMMIT；独立连接看不到此行。
-- 浏览器真实POST route.fetch()已完成，独立连接查既有43条read_at全部非null。
COMMIT;
-- 查目标read_at仍null，再向页面fulfill原POST response。
```

C每个实际GET通过route.fetch取得真实body并fulfill，保留服务器游标/ID/readAt；没有合成成功数据。随后DOM逐项按唯一时间、actor、事件类型、未读点与HTTP投影核对，再把HTTP完整ID与独立SQL全序核对。最后目标点击PATCH正文读取失败，原路径立即停止。GET503独立命令没有依赖该Response.json，也没有重发PATCH。

## 授权与失败记录

- supervisor回复：允许先只读SQL核对已发出的PATCH终态、保留方法/状态/Protocol error；不得重发PATCH或重跑C已完成序列；SQL已读且能关联真实请求可限定说明成功，响应body读取仍UNVERIFIED。然后同Playwright执行尚未开展的独立“POST成功→GET503→只GET重试”，完成清理收口。
- `C-command.txt`原退出1与`C-authoritative-notifications.txt`的STOP/UNVERIFIED保留；独立业务判断没有覆盖它们。原浏览器未保存点击后DOM，报告明确缺口。
- 原清理SQL只在验证SELECT里用 `LIKE 'a4%'`，误匹配旧cmt随机UUID，导致总结果FAIL；限定自身DELETE的参数没有使用该模式。后续仅修正只读验证范围，保留旧行与原回执。
- 没有临时命令解析失败，没有服务重试/换机制、没有再次迁移、没有重跑A/B或C已完成序列。
- 未执行typecheck/build；用户冻结实现并明确Web已重建，本轮只验收三项现场边界。

## 清理SQL与安全

清理实际SQL、删除行数和旧数据比较在 `cleanup-sql-mail.txt`，校正验证在`cleanup-scope-correction.txt`。Mailpit实际命令为DELETE `/api/v1/messages`，body只含自身两条message ID；没有清空Mailpit。内容删除用CLI使policy/cache得到正式同步，不仅SQL删表。

最终没有仓库可执行新增文件；命令只作为非可执行回执与索引留存。sha256使用相对工件路径索引，`cd artifacts/comments-accept-r4-20261012 && shasum -a 256 -c SHA256SUMS.txt` 可独立核对。
