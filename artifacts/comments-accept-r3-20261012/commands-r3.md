# 现场命令与回执索引（非可执行测试程序）

所有业务命令前置均为：

```sh
set -a
source /tmp/yoryon-accept-comments/env.sh
set +a
```

env 仅加载，未把其内容写进回执。下面保留实际命令/关键操作片段与观测；一次性 Node heredoc 未保存为执行脚本，不构建固定套件。注册密码、验证码、token、Cookie、数据库连接字符串均省略。

## 命令记录

| 顺序 | 实际命令/操作 | 回执 | 结果 |
|---|---|---|---|
| 1 | `git status --short; git rev-parse HEAD; git show --stat --oneline bd828ee` | HEAD bd828ee…；初始无 tracked/staged 变更 | PASS |
| 2 | `psql "$DATABASE_URL" -X -v ON_ERROR_STOP=1 -c '<环境/精度/迁移表 SELECT>'` | `evidence/00-environment-db.txt` | PASS |
| 3 | `curl ...:4323/api/auth/me` / `curl ...:3103/p/cmt-free` / `curl ...:11126/api/v1/info` | 401 / 200 / Mailpit v1.31.4 | 可用性观测，非业务验收 |
| 4 | `node --input-type=module <<'NODE'`，真实 register/verify-email/login；Mailpit 读自有验证码 | `01-auth-receipt.json`，两个普通用户每一步成功 | PASS |
| 5 | 一次性 Node + pg：SQL 创建 r3 内容/45 根/45 回复/60 通知，保存旧微秒 | `02-data-precondition.txt`（完整 SQL） | PASS |
| 6 | `pnpm --filter @yoryon/db migrate`，只一次 | `T1-migrate.log` | PASS |
| 7 | 一次性 Node + pg + fetch：精度/default查询、实际 default 写入、HTTP 全页与独立 SQL 比对 | `T1-time-and-pagination.json` | PASS |
| 8 | 一次性 Node：两条 PG 连接持行锁/观测权益，四个真实 HTTP 请求等待、放锁后核对 | `T2-lock-waits.json` | PASS |
| 9 | T3 一次性 Playwright 命令首次解析：page.evaluate 尾括号笔误 | `T3-command-parse-failure.txt` | 命令失败，未启动浏览器；明确获准只修临时语法 |
| 10 | T3 同机制生产 Web 访问：目标 DOM 等待超时 | `T3-browser-error.txt` | 路径停止；不是 PASS；申请诊断并获准 |
| 11 | `curl -s -D - http://127.0.0.1:3103/p/r3-free -o .../T3-diagnostic-page.html`; `curl ...:4323/api/public/contents/r3-free`; `curl ...:4323/api/public/policy/r3-free`；只读 middleware | Web404 / contents200 / policy404；SQL前置无内存policy | 证明尚未进入评论组件 |
| 12 | 经明确授权 `pnpm cli publish /Users/yoryon/Projects/yoryon-pr3-comments/artifacts/comments-accept-r3-20261012/evidence/publish-input/r3-free` | `T3-publish-precondition.log`，cache verified；policy与Web随后200 | r3隔离数据正式发布前置；非产品发布 |
| 13 | T3 原 Playwright 机制访问原锚点（第一次真正到达评论区） | `T3-anchor.json` + 两截图 | PASS |
| 14 | 只查询 `ALLOWED_ORIGINS`，输出 `http://localhost:3103` | 未打印完整env；已向supervisor说明同服务alias | 环境事实 |
| 15 | T4 一次性 Playwright：真实表单登录，route.fetch 挂旧页、UI DELETE、首页重载、放行旧页、后续完整翻页；SQL核对 | `T4-stale-root-page.json` + 截图 | PASS，限旧页先发出时序 |
| 16 | T5 一次性 Playwright：挂真实旧 liked 空响应，UI PUT、放行、UI 下一次 DELETE；SQL核对 | `T5-stale-liked.json` + 截图 | PASS，限先读后写时序 |
| 17 | T6 首次临时命令未加引号的 `503KeptAllItems` 对象键 | `T6-command-parse-failure.txt` | 命令失败，未启动浏览器；明确获准只改临时键 |
| 18 | T6 同一 Playwright 机制：挂 read-all、成功第二页、注入503；挂第三页、真实重试成功、放行旧页；SQL/DOM核对 | `T6-read-all-concurrency.json` + 两截图 | PASS，全部通知已存在于read-all之前 |
| 19 | `pnpm cli content delete r3-free`; `pnpm cli content delete r3-paid` | `cleanup-cli.log`，均cache verified | PASS |
| 20 | 一次性 Node + pg：限定自身数据SQL清理；Mailpit DELETE 自有IDs；unlink秘密临时文件 | `cleanup-sql-mail.json` | PASS |
| 21 | curl 清理后自建页面/API | `cleanup-web.txt`：两者404 | PASS |
| 22 | `cp /tmp/yoryon-accept-comments/typecheck-r3.log .../typecheck-r3.parent.log`; 同样复制build | 两父日志 | 仅辅助证据；未由此证明业务 |
| 23 | `git diff --name-only; git diff --cached --name-only; git status --short`; 脱敏扫描、工件sha256 | `final-safety-check.json`、`SHA256SUMS.txt` | 见最终回执 |

## T1 实际 SQL / HTTP 关键命令

前置完整 SQL 见 `02-data-precondition.txt`，以下查询/默认写入确已执行：

```sql
SELECT table_name, datetime_precision, column_default
FROM information_schema.columns
WHERE table_name IN ('comments','notifications') AND column_name='created_at'
ORDER BY table_name;

SELECT 'comments' AS kind, count(*)::int AS remaining_microseconds
FROM comments WHERE created_at<>date_trunc('milliseconds',created_at)
UNION ALL
SELECT 'notifications', count(*)::int
FROM notifications WHERE created_at<>date_trunc('milliseconds',created_at);

INSERT INTO comments(content_id,user_id,body)
SELECT c.id,u.id,'r3-db-default'
FROM contents c,users u
WHERE c.slug='r3-paid' AND u.username='r3_actor';

INSERT INTO notifications(recipient_user_id,actor_user_id,type,event_id)
SELECT a.id,r.id,'like',gen_random_uuid()
FROM users a,users r
WHERE a.username='r3_actor' AND r.username='r3_reader';
```

现场循环使用真实 `fetch('http://127.0.0.1:4323'+url+(cursor?'?cursor='+encodeURIComponent(cursor):''))`，凭证仅内存；每次消费服务器 nextCursor，不自行推算页号。三个 url 是 `/api/contents/r3-free/comments`、`/api/comments/a3000000-0000-4000-8000-000000000021/replies`、`/api/notifications`。证据含各页时间、ID、解码游标，及实际 SQL 全集。

## T2 实际锁/授权/HTTP操作

PG 两个连接实际执行以下结构，参数只有 r3 用户/内容/目标 UUID（没有访问旧权益）：

```sql
WITH code AS (
  INSERT INTO activation_codes(code,batch_id,grant_type,grant_content_id,note)
  VALUES($1,gen_random_uuid(),'content',$2,'r3 isolated lock boundary') RETURNING id
), redemption AS (
  INSERT INTO redemptions(code_id,user_id) SELECT id,$3 FROM code RETURNING id
)
INSERT INTO entitlements(user_id,scope_type,scope_id,valid_from,valid_until,redemption_id)
SELECT $3,'content',$2,now()-interval '1 minute',
       CASE WHEN $4='expire' THEN now()+interval '3 seconds'
            ELSE now()+interval '1 hour' END,id FROM redemption
RETURNING id,valid_until;

BEGIN;
SELECT id FROM comments WHERE id=$1 FOR UPDATE;
-- 另一个连接：
SELECT pid,state,wait_event_type,wait_event FROM pg_stat_activity
WHERE datname=current_database() AND wait_event_type='Lock'
  AND query ILIKE '%comments%for update%';
-- 权益撤销场景，第三连接在请求等待期间：
UPDATE entitlements SET revoked_at=now(),
  revoke_reason='r3 revoked during comment lock wait' WHERE id=$1;
-- 取消发布场景（仅r3-paid，结束后恢复原status）：
UPDATE contents SET status='draft' WHERE id=$1;
-- 持锁连接在失效已发生后：
COMMIT;
```

真实 HTTP：PUT/DELETE `/api/comments/<r3-target>/like`，POST `/api/contents/r3-paid/comments` 的 body 为 `{body:'r3-wait-<case>', replyToId:<target>}`。请求发出后直到锁已观测才执行失效动作；到期案等 `valid_until + 200ms`，在 stillPending=true 时放锁。before/after SQL snapshot 同时检查 like_count、comment_likes、子回复数和内容通知数。

## T3–T6 实际浏览器操作片段

共同真实浏览器 API（现场命令导入本机已安装路径，无仓库脚本）：

```js
import {chromium} from '/Users/yoryon/Projects/yoryon/node_modules/.pnpm/playwright@1.64.0/node_modules/playwright/index.mjs';
// T3匿名：chromium.launch({headless:true})
// T4–T6已登录：同端口受信origin，真实浏览器DNS映射loopback
chromium.launch({headless:true,args:['--host-resolver-rules=MAP localhost 127.0.0.1']});
// context viewport 1200x900, locale zh-CN
// T4登录：page.getByLabel('邮箱或用户名').fill(reader.username)
// page.getByLabel('密码',{exact:true}).fill(reader.password)
// page.getByRole('button',{name:'登录',exact:true}).click()
// 等真实导航 /p/r3-free，并确认当前目标aria-pressed=true
```

读取冻结实现只用于找具体按钮/请求边界，不以源码替代浏览器状态。以下是现场截获真实响应与放行的操作（每条是原命令中的关键片段，不是新增可执行套件）：

```js
// T4 旧根页：先取真实响应，再挂起其送达
page.route('**/api/contents/r3-free/comments?cursor=*', async route => {
  // 仅首次匹配拦截，其余真实continue
  const response = await route.fetch();
  const body = await response.json(); // 留ID/解码游标，不留headers
  // capturedResolve(); await gate;
  await route.fulfill({response});
});
// UI: 加载更多评论 → 取消点赞 → 等首页DOM更新 → 放行gate → 再翻完整页

// T5 旧liked：仅首次查询ids包含reply1时，route.fetch获取真实liked=[]后gate
page.route('**/api/comments/liked?ids=*', ...);
// UI: 回复1点赞，等真实PUT200且aria-pressed=true/button enabled
// 放行旧响应，读取DOM仍true；下一次click记录实际method DELETE

// T6 首次POST明确不转发，等第二页加载成功后注入503
page.route('**/api/notifications/read-all', async route => {
  // firstRead时：failCapturedResolve(); await failGate;
  await route.fulfill({status:503,contentType:'application/json',
    body:JSON.stringify({error:{code:'r3_injected_unavailable',message:'r3 acceptance injected 503'}})});
  // 后续retry真实route.continue()
});
// 第三页则先route.fetch取得20条readAt=null，再gate；真正read-all成功后fulfill原响应
// page.locator('main').evaluate检查li、aria-label未读、role=alert、按钮disabled
```

T4 DOM 与 SQL 的比较是完整 ID 序列，不仅数量。T5 在回复上点赞，不改变根列表代次，排除仅靠根刷新丢弃查询的解释。T6 UI 没有通知 ID DOM 属性，因此同时保存三页 HTTP ID 与 SQL 全序、DOM逐条文本与未读点；各页通知为明确前置的同一个线程事件显示，用 DOM数量/HTTP完整ID序列/失败前后逐条文本共同判断是否回退，未把数量单独当业务通过证据。

## 清理命令

清理详细实际 SQL 全部在 `cleanup-sql-mail.json`，参数值只为两自有用户/邮箱，邮箱值未输出。内容删除通过既有 CLI 清除内存发布policy与缓存；SQL清理自身其他数据在单事务中完成。Mailpit 实际命令为 `fetch('http://127.0.0.1:11126/api/v1/messages',{method:'DELETE',headers:{'content-type':'application/json'},body:JSON.stringify({IDs:mailIds})})`，mailIds 只包含自身两封验证码信，不删除旧信。

## 未运行与授权记录

- 本线程未运行 `pnpm typecheck` / `pnpm build`，仅复制父会话已成功日志。
- 未重跑 r2 十项、未创建固定程序/合成测试harness、未改实现或发布产品。
- 两次临时命令解析失败均在任何业务操作前停止，经明确 supervisor 授权修正后才继续。
- 实际浏览器首次404前置问题立即停止，再经明确授权只读诊断与r3专用正式发布前置；未绕过门禁、未默默换机制。
- Supervisor 额外明确要求：T4 PASS 不代表覆盖首页重载未完成时新发起旧游标分页，T6 PASS 不代表覆盖read-all之后才提交的新通知。报告均列为 UNVERIFIED。
- 后续排队指导到达时 T4 已执行且清理完成，故未重跑或重建数据。按提供路径只读核对 GPT 第三轮报告（merge verdict BLOCK），补充“无关根重载丢弃保留回复的有效 liked 查询”为第三个 UNVERIFIED；本轮 T4/T5/T6 PASS 均不推翻相应静态发现，未修实现。
