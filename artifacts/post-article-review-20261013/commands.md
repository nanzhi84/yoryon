# 本轮命令与复核入口

工作目录 `/Users/yoryon/Projects/yoryon`。以下配置路径为本轮实际使用的随机隔离配置（600），验收后已清理；不向工件复制配置、密码或会话。重新生成使用新独占PG/FS及随机密钥，不能套用生产.env。冻结输入用于核对原始作者内容，不是固定测试入口。

## 实际检查和启动

```sh
source /tmp/yoryon-post-article-review-20261013/env.sh
NODE_ENV=production pnpm build
pnpm typecheck
node apps/api/dist/index.js
NODE_ENV=production pnpm --filter @yoryon/web exec next start -p 3161
```

两个服务分别占终端会话；API4461、Weblocalhost3161。06591b0构建日志 `build-final-06591b0.txt`，typecheck日志 `typecheck-final-06591b0.txt`；最终main整合后的1629194由主代理执行同一检查，日志为 `build-integration-1629194.txt`、`typecheck-integration-1629194.txt`，reviewer实际重启最终bundle后续审并抽验。

## 旧库建立与正式迁移

在本轮PG中新库运行原0000–0005 SQL/journal，目录由原源码复制并留hash `legacy-migration-source.json`：

```sh
MIGRATIONS_FOLDER=/tmp/yoryon-post-article-review-20261013/legacy-drizzle pnpm exec tsx apps/api/src/migrate.ts
node /Users/yoryon/Projects/yoryon-pr3-comments/apps/cli/dist/index.js collection create legacy-review --title '隔离迁移验收合集'
node /Users/yoryon/Projects/yoryon-pr3-comments/apps/cli/dist/index.js publish /tmp/yoryon-post-article-review-20261013/legacy-posts
node /Users/yoryon/Projects/yoryon-pr3-comments/apps/cli/dist/index.js content pin legacy-article-public
```

首次未创建合集发布失败是预期，保留 `legacy-publish-cli.txt`；创建后重试成功。旧API/CLI须冻结70d6dd52；新包仅支持post/article。旧发布阶段unset缓存投递配置，不能从旧日志推断投递成功。旧匿名API逐篇读取，保存原公开Markdown及媒体字节hash；旧SQL快照为 `legacy-content-snapshot.json`。

正式中断点现场调用真实 `runMigrations`，只执行SQL，然后启动新API/前端观察空预览与暖缓存；这段操作为一次性内联命令，不保存可执行程序：

```sh
pnpm exec tsx --eval 'import {runMigrations} from "./packages/db/src/migrate.ts"; runMigrations(process.env.DATABASE_URL!, "./packages/db/drizzle");'
pnpm db:migrate
pnpm db:migrate
```

第一次正式应用命令完成回填，第二次证明完成行幂等。SQL阶段路径必须指当前正式0000–0010目录。现场命令/返回见 `migration-sql-stage.txt`、`migration-application-69344c7.txt`、`migration-application-rerun.txt`。

缺主媒体故障在独立 `yoryon_post_missing` 恢复旧备份后，仅删自己旧video-percent的主媒体关联，再执行正式迁移，预期明确失败且全事务回滚。空库 `yoryon_post_empty` 执行同一正式应用迁移，查询11条迁移、0篇作品、0个pending投影。恢复库独立执行：

```sh
psql -h 127.0.0.1 -p 55461 -U yoryon -d postgres -c 'create database yoryon_post_restore'
psql -h 127.0.0.1 -p 55461 -U yoryon -d yoryon_post_restore -f /tmp/yoryon-post-article-review-20261013/legacy-before-18.sql
```

表和字段快照hash来自实际 `select *` 结果排序后的JSON；迁移逐项对照ID、slug、原规则/主媒体/正文及七类历史关联。备份最终hash见README。

## 新发布与生命周期的实际命令

```sh
node apps/cli/dist/index.js publish /tmp/yoryon-post-article-review-20261013/posts
node apps/cli/dist/index.js collection create legacy-review --title '隔离迁移验收合集（元数据更新）'
node apps/cli/dist/index.js entitlement grant --user review18_member --scope subscription --days 1 --reason 'isolated post acceptance'
node apps/cli/dist/index.js entitlement grant --user review18_member --scope subscription --days 1 --reason 'isolated restore after expiry probe'
node apps/cli/dist/index.js unpublish review-mixed-post
node apps/cli/dist/index.js content delete review-mixed-post
node apps/cli/dist/index.js publish /tmp/yoryon-post-article-review-20261013/posts/review-mixed-post
node apps/cli/dist/index.js cache refresh review-paid-post
```

修改author index.md再发布的每次参数、退出码与完整回执在 `publish-rejections-cli.txt`、`reference-lifecycle-cli.txt`。失败输入分别是旧顶层media、自身UUID、随机缺失UUID、21个不同UUID、非UUID值；每次均在finally恢复原作者文件，并采集既有contents整行/引用边的hash，不把上传成功当业务成功。

权益撤销的准确ID曾在仅本地600的 `active-entitlement.json`，该秘密目录随后清理；普通回执 `member-revoke-cli.txt`保留实际ID。实际命令为 `entitlement revoke <本次ID> --reason 'isolated revocation acceptance' --by review18_admin`，没有撤销其他人的权益。

## API与SQL现场复核

匿名端点可用curl查看；会员/普通用户使用真实 `/api/auth/login`，原密码/会话只在临时600文件，不能打印请求body或Bearer：

```sh
curl -sS http://127.0.0.1:4461/api/public/contents/legacy-video-percent
curl -sS http://127.0.0.1:4461/api/public/references/c06ce84b-8409-4845-ae56-d33a7551a975
curl -sS http://127.0.0.1:4461/api/contents/review-paid-post/comments
```

私有API本轮用内联Node读取临时session JSON，在内存中设Authorization，输出仅status/DTO权限字段。媒体先手动处理302，再在内存跟随签名URL读取byte、SHA256、Range；不保留Location/URL。回执见 `permission-api.json`、`media-and-expired-permissions.json`、`revocation-and-shared-html.json`。

主要复核SQL（仅独占库）：

```sql
select slug, type, revision, preview_revision, public_preview_markdown
from contents order by slug;
select count(*) from contents
where public_preview_markdown is null or preview_revision is distinct from revision;
select content_id, referenced_id, target_id from content_references
order by content_id, referenced_id;
select c.id,c.content_id,u.username,c.body,c.like_count
from comments c join users u on u.id=c.user_id order by c.created_at;
select c.slug,ci.sort_order,c.id from collection_items ci
join collections coll on coll.id=ci.collection_id
join contents c on c.id=ci.content_id
where coll.slug='legacy-review' and c.status='published'
order by ci.sort_order,c.id;
select event_type,count(*) from analytics_events
where target_id='a88d1603-58a4-4470-af39-3771c55235db' group by event_type;
```

浏览器操作为内置IAB真实LoginForm、Feed展开/图片对话框/键盘播放器/离屏释放、post/article评论、合集导航和引用跳转；未通过page.evaluate模拟状态或发请求。DOM evaluate仅用于只读字段/媒体状态/视口检查。网络故障仅作用localhost单一Fetch/XHR资源，已清除；截图和DOM回执是该次实际可见结果。早期手动引用重试未取得成功回执，最终1629194补验在已聚焦“重试”上真实Return，成功请求发起栈含onClick且200，详见JSON/截图。
