# 本地阅读预览 2026-10-14

环境：当前未提交源码的已验收生产构建；独立 Postgres `yoryon_reading_preview_20261014`、独立配置和媒体目录。API 127.0.0.1:4117；Web http://localhost:3117。原始25篇公开内容复制到本地，生产数据未写入。临时错误复制的 article-as-post 已通过实际 CLI 删除；保留删除回执，错误演示截图不代表当前状态。

运行态：API unified exec session 68143；Web session 42155。用户已要求保留本地预览，因此此轮不停止服务或清空预览数据。环境路径见 environment.json；该文件不含凭据。配置文件0600，不放入工件。

浏览器：主 agent 预览标签4独立保留；原用户线上标签未改。仅标签4设置人工1.5秒网络延迟和下载250000 bytes/s，用于观察 `正在打开…` 和 `加载中…`；这不是实际性能测量。其余标签没有此限制。

## 本轮换行问题

修正前，8/4发布内容两句之间为双换行，生成两个p；7/24发布内容为Markdown硬换行，生成单个p两个br。两帖行高都24px，8/4额外段间margin为8px。

仅隔离预览的8/4内容改为一个p一个br，保留原文、日期、slug、type、visibility、preview。原始历史稿及全局CSS未改。spacing-before.md / spacing-after.md 保留前后输入；spacing-publish.log 为真实发布回执；corrected-note-*.json 为公开API当前数据。此问题线上同样存在，但此次未修改线上内容。

复现命令（需 environment.json 的本轮配置与临时内容目录仍保留）：

```sh
pnpm exec tsx --env-file=<temporaryRoot>/preview.env apps/cli/src/index.ts publish <temporaryRoot>/content/note-2026-08-04-1
curl http://127.0.0.1:4117/api/contents/note-2026-08-04-1
curl http://127.0.0.1:4117/api/contents/note-2026-07-24-1
```

浏览器打开首页，滚动到8/4、7/24：两帖均连续逐行展示，行距相同；其他有意段落仍保留段间距。截图 spacing-corrected.png。

点击 `先自由后财富` 标题：加载阶段显示 `正在打开…`（article-loading.png），完成后 URL `/p/freedom-before-wealth` 为独立文章全文页（standalone-article.png）。首页 article 只显示标题和摘要，不在feed展开全文。

本轮仅本地内容修正，未修改源码或新增测试程序，因此未重复typecheck/build；原性能实现的静态检查及构建结果见 artifacts/reading-performance-20261014。独立验收结果见 spacing-acceptance/。
