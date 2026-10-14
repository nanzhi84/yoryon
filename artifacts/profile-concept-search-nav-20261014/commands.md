# 实际命令与环境

目录/Users/yoryon/Projects/yoryon；environment.json：Web3015/PID24870、API4115/PID62175、隔离DB yoryon_page_redesign_20261013。

1. 通过urllib无cookies读取当前/search HTML、CSS和search page JS；核对已有返回来源/样式；只保存资源hash及必要片段served-resources.json，无大备份。
2. 只移除search/page.tsx的BackButton import/实例，差异change.patch。主标题h1直接位于main首元素；SearchPageClient、共享BackButton、history、profile表单未改，独立source对比见acceptance-source-comparison.json。
3. 根仓库 `pnpm typecheck`；`NODE_ENV=production node --env-file=/tmp/yoryon-page-redesign-m0NxxV/preview.env -e 'const r=require("node:child_process").spawnSync("pnpm",["build"],{stdio:"inherit"});process.exit(r.status ?? 1)'`。日志typecheck.log/build.log，均exit0。没有复制/冻结/备份源目录，旧预览继续运行直到新构建结束。
4. 核对11163为next-server后SIGTERM，只替换自己的本地Web。用根apps/web目录：`NODE_ENV=production node --env-file=/tmp/yoryon-page-redesign-m0NxxV/preview.env /Users/yoryon/Projects/yoryon/apps/web/node_modules/next/dist/bin/next start -p 3015 -H 127.0.0.1`，新PID24870，API保持，未生产发布。
5. 个人资料图用内置image_gen/num_last_images_to_include=1引用本轮用户个人资料截图，prompt.txt原提示，image.json原生成路径，未接到运行网页。
6. 子agent IAB surface为空，主agent用自己的hidden IABtab5 首页→全站搜索。per-tab Emulation595×896；DOM核对返回0/mainH1/padding20/title145/nooverflow，输入“示例系列”→Tab搜索按钮focus/enabled→清输入；未提交请求、不消耗额度、不改当前认证/主题/user原tab。Page.captureScreenshot显式clip生成search-preview-595.png；清viewport并将搜索tab标记为交付。
7. 根关闭/结束前读取自己tab最终精确analytics SID到0600暂存，node --env-file=... --input-type=module stdin pg执行current_database防护、REPEATABLE READ、参数化delete analytics_events where session_id=$1，仅自身统计。核对users/contents/sessions/entitlements/redemptions/search_sessions/other_analytics前后相同、自有0后COMMIT；私有SID文件删除，root-cleanup.json回执。不保存凭据。

复现前提：保持上述隔离服务和现有演示数据。新建独立Browser页签从首页搜索入口，检查h1先于表单、无返回、输入/Tab按钮焦点；本次不重新验收未改的检索权限矩阵/全文返回缓存，不创建fixture/harness。
