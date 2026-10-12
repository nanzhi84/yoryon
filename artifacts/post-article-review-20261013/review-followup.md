# #18 独立复核与迁移验收准备

截至源码 `8cef5d007fb5f5e5efac90d9ff2b6d7606b222ae`；实际基准 `origin/main=24000316eb49dfdc9f66f4f3688b257a037eadda`。此记录是中间复核，最终结论须以整合后的准确 head 为准。

## 已收口的源码观察（尚非完整业务 PASS）

- e4a86be 将匿名 paid 详情、Feed、引用改为复用 `publicPreviewMarkdown/previewRevision`；发布同事务派生投影与媒体 exposure。迁移应用入口在 SQL 完成后使用同一领域 helper 回填，null 阶段为空，旧媒体 paid 预览计算原正文以保留旧边界。
- 纯引用失效携带原有效 previewRevision；明确 SQL 内容修复导致 mismatch 时按当前正文/规则重算。
- 新引用卡片投影首个当前允许的 post 正文媒体，控件在导航 Link 外。引用与展开请求有15秒截止，主动取消不产生错误，截止进入错误/重试。
- 本 reviewer 复核回填原本只刷新目录事件且不轮换内容 revision：空预览详情缓存会复用同一 URL 86400秒。主代理在8cef5d0每行回填同事务轮换revision并对齐previewRevision；旧空投影 key 即刻不可达，目录事件更新 Feed/tag key。此项修复待现场重现确认。

## 仍待主代理修复/复核

- P2：`apps/cli/src/commands/collection.ts` 合集元信息 upsert 更新成员 revision，却未携带有效 previewRevision。旧媒体 percent 迁移预览会因这次纯元信息变更从 prepend 后正文重算，丢失原边界。已交主代理；`cache refresh` 明确针对SQL正文修复，保持 mismatch 重算合理，不能照搬 carry。

## 独立环境与旧版实路径

独占 `/tmp/yoryon-post-article-review-20261013`（700），env.sh（600随机密钥，禁止输出），PG127.0.0.1:55461数据库yoryon_post_review，API4461，预留Web3161，FS该目录/media。MAIL_SMTP_HOST127.0.0.1/PORT1无监听，不注册或发邮件。未使用主代理PG55459/API4459或评论验收API4323/Web3103。

临时真实CLI作者输入：image/video/audio分别public、paid percent20、marker、full，另article同四配置。旧正文包含自然语言、一个正文图片和marker/私有探针段；旧主媒体与公开主媒体字节分离，防止内容寻址去重导致付费主媒体本来已公开。它们仅为本次隔离发布数据，未新增固定测试程序/fixture/harness。

实际过程：initdb/pg_ctl/createdb后，将原0000–0005 SQL与journal复制到临时legacy-drizzle（哈希见legacy-migration-source.json），通过 `MIGRATIONS_FOLDER=/tmp/yoryon-post-article-review-20261013/legacy-drizzle pnpm exec tsx apps/api/src/migrate.ts` 执行。结果6条迁移、空contents；没有用drizzle push。

旧合同现场使用评论分支冻结70d6dd52已构建API/CLI（仍支持四类型）连此独占库：

```
source /tmp/yoryon-post-article-review-20261013/env.sh
unset CACHE_REVALIDATE_URL CACHE_REVALIDATE_SECRET
node /Users/yoryon/Projects/yoryon-pr3-comments/apps/api/dist/index.js
node /Users/yoryon/Projects/yoryon-pr3-comments/apps/cli/dist/index.js collection create legacy-review --title '隔离迁移验收合集'
node /Users/yoryon/Projects/yoryon-pr3-comments/apps/cli/dist/index.js publish /tmp/yoryon-post-article-review-20261013/legacy-posts
node /Users/yoryon/Projects/yoryon-pr3-comments/apps/cli/dist/index.js content pin legacy-article-public
```

首次publish因未先创建合集被正确拒绝，见legacy-publish-cli.txt；创建合集后重试成功。源媒体临时用ffmpeg产生160x90 PNG、2秒MP4/MP3，paid主媒体使用不同颜色/频率；索引source-sha256记录最终输入。采集真实 `/api/public/contents/<slug>`、匿名 `/api/media/<id>` 跟随签名URL后的字节、`POST /api/analytics/events` 并查询DB记录。保留原contents、关联、media_assets和analytics_events JSON；pg_dump备份位于临时目录legacy-before-18.sql（sha256 ccdc9813d077835a54969107142af066b737363c6f5385da662687dd60123119）。采集未将凭据/签名URL写入工件。

旧paid三类型公开预览percent328字/marker87字/full100字均从旧API实际获取，主媒体均不在DTO中；三个独占paid主媒体匿名403，公开/正文媒体字节sha256等于源文件。以上是迁移前基线，不是#18通过结论。缓存投递配置在旧发布命令中显式unset，因此记录pending(configuration missing)，不能声称缓存投递已通过。16个实际analytics view事件已入库，作为迁移保留的历史业务数据。

正式#18 migration0010整合前保持旧库。后续覆盖：完整SQL/application迁移、回填中断与恢复、nullable失败关闭/缓存版本、paid旧percent/marker/full精确预览、主媒体/曝光字节、ID/slug/发布时间/标签/合集/统计/置顶保留、纯引用/合集版本carry、SQL内容修复mismatch、发布/引用生命周期/权限、桌面移动浏览器与资源释放。尚未覆盖的项目均UNVERIFIED。
