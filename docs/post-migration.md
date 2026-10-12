# 帖子与长文迁移（0010）

本说明是生产实施步骤，不代表已执行生产迁移。隔离执行结果及准确版本见 PR 工件。

## 前提与运行入口

先停止发布、GC 及旧 API/Web 读流量，使用现有备份流程完整备份数据库和媒体。保留恢复点、旧 API/Web 发布物和运行配置。用旧 API 查询各媒体类型的正文、预览、媒体权限和关联作为基线；不得把真实付费正文或凭证写入验收工件。

只向 migrator 注入目标 `DATABASE_URL`、`MIGRATIONS_FOLDER`（默认仓库目录）和旧 API 实际使用的 `MEDIA_BLOCK_WEIGHT`（缺省 300）。本地正式入口是 `pnpm db:migrate`；容器入口仍为 `node dist/migrate.js`。源码直接运行可用 `node --import tsx apps/api/src/migrate.ts`，配置从环境注入。

应用迁移器最多等待发布锁 60 秒。SQL 迁移保留原 image/video/audio 行的 JSON 恢复快照、生成转换 revision 并转为 post；正文仍保持原样。随后 core 在每批至多 200 行的事务中使用正式 Markdown AST 注入未出现过的主媒体，并从原正文计算旧付费预览，写入版本派生投影。ID、slug、发布时间、媒体字节与 exposure、标签、合集、置顶、互动和统计均不改变。每批回填轮换 revision，使迁移期间可能产生的空预览缓存立即不可达。

缺少旧主媒体时 SQL 整体回滚。回填中失败时 SQL 已应用，之前成功的批次保留；应用迁移器退出失败，新 API 不应上线。按原配置重新运行正式入口，只处理仍未回填的行，原恢复表保留。不能直接运行 drizzle SQL migrator后宣称转换完成。

## 数据核对与启用

以下查询只输出计数，不包含正文：

```sql
SELECT type, status, visibility, count(*) FROM contents GROUP BY 1,2,3;
SELECT count(*) FROM contents WHERE public_preview_markdown IS NULL OR preview_revision IS DISTINCT FROM revision;
SELECT count(*) FROM content_type_migration_backup;
SELECT count(*) FROM content_media;
SELECT count(*) FROM content_tags;
SELECT count(*) FROM collection_items;
SELECT count(*) FROM analytics_events;
```

第二条应在迁移完成且尚未有后续 SQL 修复时为 0。逐 ID 比较迁移前后 slug、发布时间、关联和历史统计；旧媒体必须真实可见，旧匿名付费预览必须与基线一致，付费主媒体仍拒绝匿名访问。启动新 API，再部署新 Web；执行现有 `blog cache retry` 并实际读取首页、订阅、标签、合集、作品详情与媒体。未完成门禁/正文/字节核对之前，不开放发布。

`content_type_migration_backup` 属于恢复证据，不属于作品领域；没有外键级联，也不作为媒体 GC 的活跃引用。开放后新发布会重新计算规范投影；引用和合集元信息更新会携带仍有效的投影版本。SQL 正文或预览规则修复必须轮换 revision，并运行 `blog cache refresh <slug>`，该路径会按当前规则重算、更新直接引用者版本，不能复用旧投影。

## 回滚

在尚未开放新发布的窗口内，停止所有 API/Web/发布/GC，先核对完整备份可恢复。旧 API/Web 发布物需同时回退，不能让旧读取代码继续服务 post。

恢复数据库和媒体完整备份是首选方案；只回滚本次类型转换时，在事务内先移除 `contents_type_check`，再用恢复表 JSON 的原 `type`、`body_markdown`、`updated_at` 恢复相同 ID 行，并轮换新的 revision 以阻断新部署生成的缓存。其余关联/统计原本未变，不需覆盖。重启旧 API/Web 后执行旧版缓存刷新并读取实际用户路径，确认后才能开放。恢复表和备份继续保留。

开放后已发布的新帖子或引用关系不能靠上述窄回滚自动转换回旧四类型；需要选择一致的数据库/媒体恢复点或另行制定保留新数据的回滚方案，不能默默丢弃新作品。
