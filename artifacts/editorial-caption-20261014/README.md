# Caption统一与参考排印校准

入口 http://localhost:3016/p/editorial-reference 。Caption组件见apps/web/components/caption.tsx：独立说明用p，figure内可用as="figcaption"。Markdown消费明确图注标签“代码 N/图 N/列表 N/卡片组”或图片后整段斜体“图 N：…”，后者必须唯一em；不会把混合说明/正文猜成caption。渲染修饰在搜索文本装饰之后，只添加样式class，不改原文、节点id与字符范围。公开SSR和私有客户端共用MarkdownSurface，不新增API字段、依赖或测试程序。

字体栈与原站逐字补齐，字重、字号、行高见main-agent-browser-evidence.md和typography-desktop/mobile.json。Caption13px/1.55/400，标签600；原样对齐sans/serif/mono；正文400/粗体650；移动断点640；阅读区字色和抗锯齿auto按原版。React技能核查：组件纯展示，无新增状态/hook/请求，Props明确，p/figcaption使用保持合法上下文。

静态检查根目录pnpm typecheck通过typecheck-final.log；隔离构建副本pnpm build通过build-final.log。初版回执保留，最终版本为边界修复与抗锯齿校准后的源码，source-manifest.json与sources保留完整文件含新文件。环境/源码基线沿用../editorial-layout-20261014/environment.json/version.txt，独立dev/build副本已同步。本轮没有改数据库或样例内容。

本地启动在dev副本apps/web目录：

```sh
ALLOWED_ORIGINS=http://localhost:3016 SITE_URL=http://localhost:3016 node --env-file=/tmp/yoryon-page-redesign-m0NxxV/preview.env /Users/yoryon/Projects/yoryon/apps/web/node_modules/next/dist/bin/next dev -p 3016 -H 127.0.0.1
```

前提：4115隔离API、DB yoryon_page_redesign_20261013、FS /tmp/yoryon-page-redesign-m0NxxV/storage、私有preview.env可用，3016空闲。构建命令见上一轮README，pnpm_config_verify_deps_before_run=false复用已安装依赖。验收复生成：原版与组件页在同Browser同1280/375视口比较computed style，用原生输入搜索上述图注原文并点定位，不以HTTP200代替结果。

独立范围与限制见acceptance.md；主agent真实现场、SSR独立核查和工件复核来源分别标注。无生产改动。清理仅自身统计与搜索会话，用户页面和交付样例保持。
