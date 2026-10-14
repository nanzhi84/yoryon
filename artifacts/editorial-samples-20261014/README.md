# 用户交付的长文排版样例

入口 http://localhost:3016/c/editorial-preview 。4篇：参考文章中文转载、原创散文、原创技术手记、原创图文说明。正文文件在posts各子目录index.md。原始HTML/source.json保留来源与转载许可；对照HTML仅在本地预览副本public/reference-article.html，不加入生产页面。

本轮只添加用户要求保留的隔离样例内容，不修改组件/协议，不新增依赖或测试程序，不发邮件、不写生产。原有示例与用户测试账号保留。源版本/环境沿用../editorial-layout-20261014/environment.json和version.txt，DB yoryon_page_redesign_20261013，FS /tmp/yoryon-page-redesign-m0NxxV/storage。所有连接凭据留在私有env。

实际发布前已通过PG current_database与FS路径guard，CLI collection create + publish回执publish.log。后续参考文章仅调整Markdown结构与保留原文日期/人物原链接，回执reference-republish-final.log。

复生成：先启动原隔离API与3016（命令见上一轮README），确认数据库名和STORAGE_BACKEND=fs，在仓库根执行：

```sh
node --env-file=/tmp/yoryon-page-redesign-m0NxxV/preview.env --import tsx apps/cli/src/index.ts collection create editorial-preview --title '长文排版预览' --description '参考文章与三种原创长文组合，仅用于本地预览。'
node --env-file=/tmp/yoryon-page-redesign-m0NxxV/preview.env --import tsx apps/cli/src/index.ts publish artifacts/editorial-samples-20261014/posts
```

仅对上述隔离env执行。发布按slug upsert。缓存事件报告configuration missing；页面实时版本读取已呈现新增文章，不能以事件pending代替实际页面检查。样例按用户要求保留，并非应清理的验收fixture。当前组件没有GFM表格，图文示例用原创SVG对照图。原版轮播/流程布局与现有Markdown结构的区别在页面注明。

独立只读验收acceptance.md和read-only-receipts.json；主agent补真实375px代码滚动与图片弹层main-agent-browser-evidence.md。未再修改源码，因此不重复上轮typecheck/build，原始通过回执见上一轮工件。
