# 本次真实验收命令与复现

执行环境：/Users/yoryon/Projects/yoryon；Web/API、隔离数据库与存储见 environment.json。复现时保持同一隔离服务运行，使用用户交付的账号密码，禁止将密码、会话 cookie、token 或数据库 URL 写入工件。

浏览器实际操作（独立隐藏 IAB 标签）：

1. `cua.createBrowserTab('iab', 'http://localhost:3015/', {visible:false})`。
2. 点击“账户菜单”，确认登录/注册匿名状态；点击“登录”。
3. 从 0600 私有文件读凭据到变量；`getByRole('textbox', {name:'邮箱或用户名'}).fill(credentials.username)`、`getByLabel('密码', {exact:true}).fill(credentials.password)`，点击登录按钮。
4. 点击“订阅”，核对已开通、到期日期与剩余 1 次提问，并保存会员截图。
5. 点击“付费演示文章（含图片与视频）”；等待“正在加载正文…”隐藏，读取实际 AX，核对视频后的第 8 段及评论输入框，并保存截图。
6. 点击账户菜单，核对个人资料/退出登录，再点击退出；返回首页菜单核对登录/注册并保存截图。
7. 关闭标签前，通过此 tab 的 CDP `Runtime.evaluate` 只读取 `sessionStorage.getItem('yoryon_analytics_sid')`，结果写入 0600 私有临时文件；关闭自己的标签。未输出 SID。

SQL 清理实际由一次性 stdin 执行，无新增可执行测试文件。下面保留入口与事务执行流程；这段 JS 是流程摘要，实际 SQL 与回执在其后列出，复现须将该次独立标签读取的精确 SID 作为参数绑定：

```sh
cd /Users/yoryon/Projects/yoryon/apps/cli
node --env-file=/tmp/yoryon-page-redesign-m0NxxV/preview.env --input-type=module <<'JS'
// 用 pg 连接环境变量 DATABASE_URL；凭据不输出。
// 从私有 SID 文件读取 sid，从 provision.json 读取 userId。
// 验证 current_database() = 'yoryon_page_redesign_20261013'。
// BEGIN ISOLATION LEVEL REPEATABLE READ。
// 读取下列各计数为 before，执行精确 SID 删除，再读取 after。
// own = 0、其他统计与业务计数不变、sessions = 0 后 COMMIT。
// 仅计数写 cleanup.json，删除私有 SID 文件；异常 ROLLBACK。
JS
```

实际 SQL（参数 `$1` 是此验收标签最终 SID，`$2` 是 provision.json 中用户 ID）：

```sql
SELECT current_database() AS name;
BEGIN ISOLATION LEVEL REPEATABLE READ;
SELECT
 (SELECT count(*)::int FROM analytics_events WHERE session_id IS DISTINCT FROM $1) AS others,
 (SELECT count(*)::int FROM users) AS users,
 (SELECT count(*)::int FROM contents) AS contents,
 (SELECT count(*)::int FROM entitlements WHERE user_id=$2) AS entitlements,
 (SELECT count(*)::int FROM redemptions WHERE user_id=$2) AS redemptions,
 (SELECT count(*)::int FROM sessions WHERE user_id=$2) AS sessions,
 (SELECT count(*)::int FROM comments WHERE user_id=$2) AS comments,
 (SELECT count(*)::int FROM content_likes WHERE user_id=$2) AS likes,
 (SELECT count(*)::int FROM member_questions WHERE user_id=$2) AS questions;
DELETE FROM analytics_events WHERE session_id=$1;
-- 重复上面的计数查询，另查本 SID count = 0；核对后提交。
COMMIT;
```

真实回执：cleanup.json；删除 8 条自身统计、其他统计 167 条不变、账户无会话，会员权益与兑换保留。第一次 SQL 42703 已回滚，修正为 comments.user_id 后成功。
