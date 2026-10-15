# 会员目录独立验收

时间：2026-10-15（Asia/Singapore）。执行：独立子 agent。无源码变更。
环境：独立新建 PostgreSQL 数据库 yoryon_member_accept_20261015，经实际 migrate.ts 迁移；独立 API 端口 4127。主预览数据库未写入。

## 数据前提与结果

现场使用 pg Client 插入29篇文章：27篇已发布paid、1篇已发布public、1篇paid草稿。另建4合集：c0含2篇已发布paid+1篇已发布public+1篇paid草稿；c1含c0内同一paid；c2仅public；c3仅paid草稿。其余25篇paid不归属合集。所有排序时间相同2026-10-15T03:00:00.123Z，覆盖同毫秒UUID分页边界。

- PASS：目录按合集聚合，c0只出现1条，itemCount=3/paidItemCount=2，未计草稿。
- PASS：同一paid属于c0/c1时两个合集分别出现；属于合集的paid没有重复单列。
- PASS：纯免费c2、仅草稿c3均排除；public与draft不单列。
- PASS：聚合后27条=2合集+25独立paid，两页20/7；27个(kind,id)唯一且完整覆盖预期集合，无漏重。
- PASS：cursor=not-json返回400 invalid_cursor；version=old-version返回409 snapshot_expired。
- PASS：匿名访问public/contents与contents均无PRIVATE_BODY_SENTINEL全文，仅预览契约；不因目录付费标记返回正文。

完整JSON回执：independent-api-receipts.json。API响应与业务集合核对同时使用，未以200或数量单独宣称业务通过。

## 实际命令与复现

从根目录执行，配置只保存/tmp私有文件，不入工件。用node --env-file=/tmp/yoryon-local-preview-20261015.env --input-type=module读取现有连接，通过pg Client连postgres库执行CREATE DATABASE yoryon_member_accept_20261015，随后私有复制env，仅替换数据库名及PORT=4127。

迁移：`node --env-file=/tmp/yoryon-member-accept-20261015.env --import tsx apps/api/src/migrate.ts`。回执：searchProjections=0；SQL migrations and public preview backfill applied。
启动：`node --env-file=/tmp/yoryon-member-accept-20261015.env --import tsx apps/api/src/index.ts`。回执：api listening on :4127。

种子由临时node stdin命令通过SQL INSERT contents / collections / collection_items完成，上述数据关系即完整数据前提；不新增可执行测试程序。Python urllib.request.urlopen请求http://localhost:4127/api/member-feed，读取nextCursor并携带首版version直到null；逐项核对业务集合、去重和计数。请求路径和完整响应均存于JSON回执，可用相同路径重放。

清理：SIGINT退出独立API；pg Client连接postgres执行DROP DATABASE yoryon_member_accept_20261015；删除/tmp/yoryon-member-accept-20261015.env。实际命令回执：Isolated API stopped; database dropped; temporary config removed. Main preview data untouched。

## 未验证

UNVERIFIED：订阅页最终UI、窄屏长简介、UI跨页加载、网络失败重试、真实发布触发version更新后旧游标失效、跨kind完全相同UUID和时间的分页边界（同毫秒不同UUID已覆盖）。子agent上轮CUA无浏览器可见性；等待主agent实际UI证据及落盘截图，之后可独立审图。无支付/权益授予/生产写入/邮件发送。

## 补充 UI 证据审阅

主agent实际Browser执行：当前订阅页1合集+1独立作品，点击合集进入目录；704px简介高度240、375px简介高度528，完整展示；375px订阅摘要72px（三行），封面可见，scrollWidth360<375。以上动态操作和DOM数值归主agent执行。

子agent通过view_image独立审阅4张落盘截图：subscription-desktop.jpg（实际539px）、subscription-375.jpg、collection-long-704.jpg、collection-long-375.jpg。PASS：订阅页将会员合集只列一次，显示8篇/1篇会员，另列独立付费示例；列表摘要省略且封面完整。PASS：704px/375px合集详情长简介完整显示末句“仅供本地预览”，未省略；窄屏目录、日期、免费/会员标记可读，无明显横向裁切。注：窄屏简介被封面右列挤压为较窄长列，属于实际截图布局，并非截断。

## 补充隔离分页 UI 环境（等待主agent后续验收及通知清理）

重建同名独立库yoryon_member_accept_20261015及私有配置/tmp/yoryon-member-accept-20261015.env；迁移回执searchProjections=0；SQL migrations and public preview backfill applied。
现场node stdin SQL种子：27已发布paid文章accept-0..accept-26，标题“隔离会员作品 N”、正文PRIVATE_BODY_SENTINEL、published_at均2026-10-15T03:00:00.123Z；合集accept-collection含accept-0/1，另25篇无合集。预期聚合26条，页长20/6。
实际启动：node --env-file=/tmp/yoryon-member-accept-20261015.env --import tsx apps/api/src/index.ts。回执api listening on :4127。服务暂保留，等待主agent隔离Web3027真实LoadMore/版本刷新后通知清理。无主preview数据写入。

## 最终追加：分页、真实发布后版本与清理

主agent在隔离Web3027内置Browser实际滚动加载两页；子agent独立读取browser-paging.json核对26个唯一href：1个/c/accept-collection，加accept-2..26共25个独立作品；无accept-0/1重复章节。view_image审阅paging-second-page.jpg确认第二页合集与独立作品实际可见。PASS（主agent执行、子agent独立回执/截图审阅）。

正式CLI更新合集后，publish-refresh-command.log记录upsert成功、cache事件45792014-b6fa-4905-b963-2e3fe0e74539 pending(configuration missing)；browser-refresh.json记录版本由全零变为该事件版本。view_image审阅publish-refresh.jpg确认“隔离会员合集（已更新）”和新描述实际可见。证明推送缺配置时reload仍读到新目录。PASS（主agentBrowser执行、子agent独立回执/截图审阅）。

子agent随后独立请求http://localhost:4127/api/member-feed?version=00000000-0000-0000-0000-000000000000，实际409；响应存old-version-after-publish.json。PASS：真实CLI写入版本后旧版本失效，不仅是任意伪造版本。

最终清理已执行：主agent停Web3027、删除Web私有env并关闭临时tab；子agentSIGINT停API4127，通过pg Client DROP DATABASE yoryon_member_accept_20261015并删除/tmp/yoryon-member-accept-20261015.env。回执：PASS: second isolated API stopped, database dropped, private config deleted; main preview untouched。

最终结论：本次范围PASS（API数据边界、业务集合分页、400/409、匿名隔离、实际Web LoadMore、发布后reload刷新、列表/详情长简介及窄屏截图）。UNVERIFIED仍限网络失败重试、跨kind完全相同UUID与时间边界，以及生产部署。子agent未独立操作Browser，动态UI行为归主agent执行，独立证据审阅如上。主agent另报告pnpm typecheck及pnpm build通过，不能替代上述业务证据。
