# 独立验收操作回执

本记录是现场验收命令说明，不是固定测试入口或可执行测试程序。仅作用于本任务隔离环境；凭据不会写入工件。

## 环境与数据前提

- 工作区 `/Users/yoryon/Projects/yoryon`，Web `http://localhost:3015`，API `http://127.0.0.1:4115`。
- PostgreSQL 数据库必须严格等于 `yoryon_page_redesign_20261013`；连接由 `/tmp/yoryon-page-redesign-m0NxxV/preview.env` 注入，每次 SQL 写操作前实际查询 `current_database()`。
- 使用现场新建的两个验收用户。用户名和 ID 见 `acceptance-data-premise.json`；随机密码、会话令牌只在 chmod 0600 的 `/tmp/yoryon-page-redesign-m0NxxV/feed-acceptance-private.json`。
- 账号通过独立 API 的 `/api/auth/login` 登录；没有注册邮件或真实邮件传输。会话创建状态见 `acceptance-login.json`。

## 已执行命令

读取代码：`cat packages/core/src/content-interactions.ts`、`cat apps/api/src/routes/content-interactions.ts`、`cat apps/web/components/content-actions.tsx`、`git diff -- apps/web/app/api/[...path]/route.ts apps/web/components/feed-timeline.tsx apps/web/components/post-entry.tsx packages/db/src/schema.ts`。

数据库只读与隔离用户准备：在 `packages/db` 工作目录运行 `node --env-file=/tmp/yoryon-page-redesign-m0NxxV/preview.env --input-type=module`，通过 stdin 的一次性 JavaScript 导入 `pg`。读取 `contents` 的 ID/slug/status/visibility 和用户/会话/评论计数，核对原始 7 篇演示、0 用户/会话/评论，再对两个随机验收密码用既有 `argon2` 生成哈希并写入两个 `status='active'` 用户。明文仅写私密临时文件，工件输出不含明文。

API 实际登录：用 Node fetch 分别 `POST http://127.0.0.1:4115/api/auth/login`，JSON 字段为 `emailOrUsername` 和临时密码，读取并保存随机 Bearer 会话到私密临时文件，工件只保留 HTTP 状态、用户 ID 和 `tokenIssued`。

## 浏览器

独立验收 agent 创建自己的内置 Browser 隐藏标签到 `http://localhost:3015/`，不复用用户标签/登录。构建更新后会执行真实 UI 操作；截图与结果另存。

## 互动边界命令

使用一次性的 `node --env-file=/tmp/yoryon-page-redesign-m0NxxV/preview.env --input-type=module` stdin JavaScript，导入 `pg`、`node:fs` 和 `node:crypto`，从私密临时 JSON 读取验收令牌。所有请求回执只保存 method/path/status/cache/body，不保存 Cookie、Authorization 或数据库连接串。

- 真实请求 `GET /api/content-interactions?ids=<本地音频ID>,<本地付费作品ID>,<本次草稿ID>,<随机不存在ID>`；非法 UUID、重复 ID、101 个 ID 请求分别留存。
- 实际 `PUT /api/content-interactions/<音频ID>/like`：A 重复请求，8 个并发 PUT；SQL `select content_id,user_id from content_likes where content_id=$1`；B 读取后点赞，分别核对 A/B/游客。实际重复 DELETE 和 B 的 6 个并发 DELETE，再 SQL 核对无事实行。
- BFF 使用相同临时 Cookie 发送 `PUT /api/content-interactions/<音频ID>/like`，分别设置外站 Origin、无 Origin/site、`sec-fetch-site: cross-site` 和 `same-origin`；身份读取以 A/B/无 Cookie 顺序核对。
- 在隔离 DB 为 A 创建一条自有激活码、兑换和权益事实。先测无权益，再设置有效 content 权益、到期、撤销、未来开始、有效 subscription 区间，分别实际读/写。B 没有对应权益，单独测拒绝。授予前提由现场 SQL 建立，不调用真实兑换/邮件。
- 本次临时草稿逐步设为 published→draft→删除，测读写与 content_likes 删除级联；B 临时 disabled 后测会话失效，再恢复 active。
- 使用既有评论 API `POST /api/contents/demo-audio/comments` 创建自有根评论和回复；批量互动从2条变为软删回复后的1条。

回执分别为 `acceptance-api-public.json`、`acceptance-api-boundaries.json`；本次修改和删除仅限临时验收实体。

## 真实 UI 与故障

1. 游客点击音频点赞进入 `/login?returnTo=%2F`，填写私密临时凭据正常登录。A 点击点赞、reload、取消，并用 Enter 触发点赞；B 从现有账户菜单重新登录，核对同一内容 count=1 但自身未赞，再点赞到2、取消回1。
2. 真实点击转发。浏览器显示“链接已复制”，剪贴板读取为 `http://localhost:3015/p/demo-audio`；打开搜索对话框后在输入框按 Meta+V，实际粘贴同值。以 CDP `Network.requestWillBeSent` 的操作前后游标核对转发没有发出请求。
3. 以本标签 CDP `Network.setBlockedURLs` 临时阻断 `http://localhost:3015/api/content-interactions*`，reload后看到加载失败与重试；恢复空阻断列表，点击重试恢复。再只阻断 `http://localhost:3015/api/content-interactions/*/like`，实际点赞失败并保留计数，恢复后重试成功。修复后重做写失败路径，中文反馈为“网络请求失败，请重试。”；所有阻断最终恢复为 `urls:[]`。
4. Browser 原生权限覆盖 `Browser.setPermission` 不受此工具支持。为验证回退，仅对当前本地文档通过 CDP `Runtime.evaluate` 临时覆盖 `navigator.clipboard.writeText` 以拒绝 `NotAllowedError`；实际转发显示手动链接。点击输入框自动全选，Meta+C 后剪贴板等于链接。reload完全移除该临时故障，正常转发恢复。没有修改产品代码、浏览器权限或其他标签。
5. 评论实际从首页/订阅页点击；以只读 DOM 测量 `location.hash`、`id=comments`、scrollY与视口几何。第一次发现缺失锚点并保留 FAIL 证据；修复后现有长文实际 scrollY=953，评论区落在视口 y=547，文档1673/视口720。
6. 未改变主题或视口，默认1280×720。读取 computed style确认 body `rgb(253,254,255)`，阅读区/文章透明无围合边框，日期在标题行，三项动作为评论/点赞/转发。无内容头像或 @。
7. 当前产品没有现成登出 UI；通过本地浏览器实际 `fetch('/api/auth/logout',{method:'POST',credentials:'same-origin'})` 调用既有 BFF 登出路径，200 `{ok:true}`，并 reload 恢复匿名。未输出 Cookie/令牌。

8. 构建切换后第一次Next Link评论导航丢hash的中间失败已保留。最终原生`<a>`版本重新刷新列表后首次点击长文评论保留`#comments`，实际scrollY953/评论区y547；帖子也首次保留`#comments`。最终回执是`acceptance-comment-native-final.*`与`acceptance-post-native-final.*`；名字带tracked-final/anchor-final的旧回执属于中间版本。

## 清理命令

关闭本agent专用IAB标签后，在已核对current_database的连接中开启事务，按自有用户ID/自有实体ID精确删除：`notifications`（自身recipient/actor）、`comment_likes`、回复后根评论、`entitlements`、`redemptions`、`activation_codes`、自身`sessions`和`users`。删除用户前查询自身`content_likes`还有1行，删除用户后FK级联为0。仅按本标签的`session_id`删除33条`analytics_events`，不清除其他标签统计。临时草稿此前已删除。

事务提交后查询自身用户/会话/赞/评论/统计均0，7篇原演示仍published。读取工件字节与本次私密密码/令牌及环境秘密值做精确扫描，69个文件无命中；删除私密临时JSON并核对不存在。回执`acceptance-cleanup.json`，没有把扫描值或连接串写入工件。
