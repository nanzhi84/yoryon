# 第五轮一次性现场命令 / 回执索引

只读冻结实现，业务操作以直接 Node heredoc 执行，**没有**保存可执行脚本、固定套件或 harness。共同环境前置（未打印变量值）：

```sh
set -a; source /tmp/yoryon-accept-comments/env.sh; set +a
node --input-type=module <<'NODE'
# 一次性现场操作；下文仅保留脱敏控制点，不作为执行程序。
NODE
```

## 实际顺序与退出结果

| 顺序 | 实际命令 / 操作 | 回执 | 退出 / 业务结论 |
|---|---|---|---|
| 1 | `git status --short; git rev-parse HEAD; git branch --show-current; git show --stat --oneline ff84d80`；只读 NotificationList、CommentSection、BFF、登录和站点 Link、迁移定义 | 本报告版本 / `00-environment.txt` | 起始 tracked/staged 空；未执行迁移 |
| 2 | `date -u; node --version; sw_vers; psql "$DATABASE_URL" -X -v ON_ERROR_STOP=1 -c '<库地址、迁移计数、cmt-free 发布属性、r5 用户不存在查询>'`；curl API feed、Web、Mailpit，Node 敏感标记检查后复制父静态三份 txt | `00-environment.txt`、`build-r5.txt`、两个 `typecheck-r5*.txt` | 0；仅基础可用 / 静态旁证，不代替业务 |
| 3 | 一次性 Node + pg：读旧业务行并仅落 SHA256 / 数量；两 r5 用户真实 BFF register → 本地 Mailpit 取仅自己的验证码 → verify-email；验证种下的真实会话在 BFF POST 自己一条 cmt-free 根评论；SQL 插三条自身通知 | `01-auth-precondition.txt` | 0 / PASS；无旧行改动 |
| 4 | 一次性 Playwright + pg：真实 Web 登录；read-all 真实 route.fetch 完成 → SQL 已读 → 原响应挂起 → 点 Yoryon Link SPA 到首页 → 同源真实 logout → auth/me401 → 放行原成功 → 观察网络/URL/DOM/SQL并截图 | `A-lifecycle-read-all.txt`、A 截图 | 0 / PASS |
| 5 | 一次性 Playwright + pg：只将自有有链接通知重置未读；真实 Web 重新登录；点击该通知 PATCH route.fetch 成功 → SQL 已读 → 点 Yoryon Link SPA 首页 → 放行原响应，观察迟到导航 | `B-lifecycle-mark-read.txt`、B 截图 | 0 / PASS |
| 6 | 同一浏览器：SQL 只重置自身两条 link=null 通知未读；通过站点真实通知 Link 进入；正常点击第一条 PATCH，DOM 未读2→1和SQL核对；正常 read-all POST→真实首页 GET，未读→0 / 按钮恢复 | `C-mounted-normal.txt`、两张 C 截图 | 0 / PASS；未重跑 r4 事务矩阵 |
| 7 | 一次性 Node + pg：只读自身根评论实际排序位置 | `D-precondition.txt` | 0；初始第24 / 39根，为看到自有对象需要一次真实分页 |
| 8 | 一次性 Playwright + pg：恢复 C 的0600会话；cmt-free 首页与一次可见分页看到自身对象；根点赞真实 PUT200 → 随后无cursor根GET明确注入一次503 → 两种提示可见 → 点击该提示内“重试” → 真实首页/context/liked GET，旧提示都消失；自身红心、回复/取消/未发送草稿可操作；最后真实 logout/me401 | `D-comment-retry-clears-errors.txt`、三张 D 截图 | 0 / PASS；未再发送点赞，未新增回复 |
| 9 | 工具逐一打开七张截图核对可见结果 | `acceptance-r5.md` | 与网络 / SQL / DOM 投影一致 |
| 10 | 一次性 Node + pg：事务限定自身UUID删除3通知、1点赞、1评论、2会话、2验证码记录、2用户；精确零残留查询；八类旧业务行有序SHA256比较；Mailpit DELETE仅自己两个ID并核查；unlink 两个0600秘密临时文件 | `cleanup-sql-mail.txt` | 0 / PASS；八类旧行hash完全一致 |
| 11 | `git diff --exit-code; git diff --cached --exit-code; git status --short`，秘密文件不存在 / 工件敏感标记 / 非执行文件检查；相对目录 `find ... -print0 | sort -z | xargs -0 shasum -a 256` 及 `shasum -a 256 -c SHA256SUMS.txt` | `final-safety-check.txt`、`SHA256SUMS.txt` | 最终回执；hash生成后不改索引文件 |

## 浏览器机制（实际控制点）

```js
import {chromium} from '/Users/yoryon/Projects/yoryon/node_modules/.pnpm/playwright@1.64.0/node_modules/playwright/index.mjs';
chromium.launch({headless:true,args:['--host-resolver-rules=MAP localhost 127.0.0.1']});
// 1200×900、zh-CN；真实登录表单 getByLabel('邮箱或用户名') / getByLabel('密码',{exact:true})。
// 从通知离开只用 getByRole('link',{name:'Yoryon',exact:true}).click()。
// window.__r5Document 标记跨SPA保留；网络记录 document=true 请求在离开区间为空。
```

A / B 都用真实服务器响应，不合成成功数据，不读取 Playwright 写响应正文：

```js
const response = await route.fetch(); // 记录真实POST/PATCH status；SQL先查最终已读。
await gate;                         // 只挂交付，不挂服务器写入。
await route.fulfill({response});     // SPA离开（A再真实注销）之后才交付。
// 页面真实logout：fetch('/api/auth/logout',{method:'POST',credentials:'same-origin'})。
// 紧接GET /api/auth/me记录401；不改Cookie/Origin，不绕CSRF。
```

A 真实响应完成至交付约59ms，B约47ms，均远小于组件15秒 timeout；释放后各观察1500ms。记录全部 `/api/` 方法/路径/status及document请求，不记录请求头、密码、token或Cookie。`/api/notifications/unread-count` 单独保留路径，**不**误当成列表 `/api/notifications` 首页读取。

D 注入仅目标根首页读取，一次后自动撤销：

```js
// URL pathname严格等于 /api/contents/cmt-free/comments；仅GET且无cursor。
// 真实PUT200之后的下一次根GET返回503，body仅脱敏的r5注入错误标识。
// 可见“评论列表刷新失败。”内按钮“重试”触发真实 loadAll；后续全部 continue。
// 网络显示重试只GET根首页、context、liked；没有第二次PUT。
```

浏览器工具未调用 `Playwright Response.json()` 读取 POST/PATCH/PUT。生产组件自己的 fetch JSON 解析照常执行；Node 注册/验证/建评论前置在内存读取必要JSON，工件只留业务投影。

## 关键 SQL（实际查询 / 清理细节另见业务 txt）

```sql
SELECT id,read_at FROM notifications WHERE recipient_user_id=$1 ORDER BY id;
SELECT id,read_at FROM notifications WHERE id=$1;
SELECT c.id,c.like_count,
  (SELECT count(*)::int FROM comment_likes l WHERE l.comment_id=c.id AND l.user_id=$2) AS own_like
FROM comments c WHERE c.id=$1;
```

- 三条通知 SQL 前置完整原文、UUID、绑定说明和返回行在 `01-auth-precondition.txt`。
- B/C 的 UPDATE 仅限定自建通知UUID与 r5_reader；没有旧通知/权益/内容/评论 UPDATE。
- 清理 DELETE 原文、删除量、精确UUID剩余查询结果以及每类有序旧行hash见 `cleanup-sql-mail.txt`。完整旧内容/权益行只在内存做hash，不写入工件。
- Mailpit实际 `DELETE /api/v1/messages`，JSON `{IDs: [仅本轮自己的两个ID]}`；不清空Mailpit，不删他人消息。
- 没有业务工具/服务失败、语法解析失败或协议正文读取错误，无写操作重发。源码定位时一次读取不存在的 `site-nav.tsx` 返回 ENOENT，发生于任何业务操作前；随后按实际文件名 `site-header.tsx` 只读定位，不属于业务服务重试。

父静态回执原有 typecheck/build 并行竞态失败完整保留；没有隐去。完整build后父流程串行typecheck通过。本轮没有再次运行typecheck/build，也没有重启服务。
