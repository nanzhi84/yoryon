# 居中标题与本文要点卡片

本地预览 http://localhost:3016/p/editorial-reference ，另外3篇长文也有要点卡片。依据原站真实CSS及用户截图：居中标题31px/1.38，元信息在标题下方，52px下留白；浅灰卡片18/20/6px内距、6px圆角、22px圆形编号、34px左内距、粗体标题独立行、16px条目间距、暗红跳转链接。深色主题适配。

Markdown渲染边界在rehypeSearchText后，将顶层“本文要点”标题及其紧邻非空有序列表包为section。普通列表、无要点文章保持原状。没有新API字段、依赖、slug特判、摘要生成或私有正文泄漏路径。MarkdownSurface公开/客户端共用，未新增hook/request。React检查沿用react-best-practices：服务端ContentView和现有Markdown边界，无额外组件状态或请求。没有新增测试程序。

4篇用户交付样例按已有CLI在精确隔离DB/FS guard后重新发布；原文日期和描述恢复原作者元信息，来源说明移至卡片后，全文保留。publish.log为回执。参考数据样例在../editorial-samples-20261014/posts。

环境、源码基线、数据前提沿用../editorial-layout-20261014/environment.json与version.txt。dev/build独立副本已同步本次源码。静态：根目录pnpm typecheck，通过typecheck.log。构建：build-workspace运行pnpm build，build.log通过。完整启动前提和构建命令见上一轮README。

3016正确启动命令（dev副本apps/web目录）：

```sh
ALLOWED_ORIGINS=http://localhost:3016 SITE_URL=http://localhost:3016 node --env-file=/tmp/yoryon-page-redesign-m0NxxV/preview.env /Users/yoryon/Projects/yoryon/apps/web/node_modules/next/dist/bin/next dev -p 3016 -H 127.0.0.1
```

仅停止本任务预览进程后使用此命令。API4115、隔离DB yoryon_page_redesign_20261013、FS存储须可用，秘密env不进入工件。首次搜索因旧origin配置失败、本地修正与实际成功回执详见main-agent-browser-evidence.md。

独立验收范围与未验证项见acceptance.md。独立Browser本轮不可用，由独立agent核查6篇SSR和源码，主agent补真实桌面/窄屏/主题/搜索定位并提供截图。不要将源码/HTTP/构建通过当作浏览器业务验收。
