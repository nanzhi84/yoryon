# 浅蓝头像版真实页面预览

本地入口：首页 http://localhost:3015/；订阅 http://localhost:3015/subscription。运行的是当前修改代码的独立构建副本，使用隔离 API 4115、隔离 PostgreSQL 与 FS 存储。原有本地服务与生产未变更。原头像作为 public/images/author-avatar.jpg 提供，Next Image 优化下载、CSS 圆形裁切。

## 修改范围与版本

业务目标、领域边界、数据流与编码前失败边界见 design.md。基础提交为 b8e7098e941f80d899cd6483a9ce236732e5ddf6；实际未提交源文件与预览副本 SHA-256 见 source-manifest.json。implementation.patch 保存前端与 ADR 的差异，原头像作为新增文件留在 apps/web/public/images/ 下。

实现：白色阅读栏与浅蓝画布；作者圆形头像；双主题浅蓝灰语义色；导航与按钮强调色；紧凑订阅状态区；首页订阅提示；真实媒体点击入口、问答空态与响应式布局。继续使用既有内容、播放器、目录、会员权限、价格及兑换流程。

## 实际静态与构建检查

工作区执行 pnpm typecheck，exit 0，日志 typecheck.log。根 agent 按 React best practices 检查：只添加展示信息，无新客户端取数、无 effect 派生状态、没有新增依赖；Image 有稳定宽高并加载小尺寸优化图；按钮与装饰图标的可访问名称和键盘焦点延续既有语义。文本/按钮的实际主题令牌对比度计算见 color-contrast.json（此计算不代替整页可访问性验收）。

构建在临时源码副本复用现有已安装依赖，避免改写原有 3101 服务的 .next。实际命令：

```sh
cd /tmp/yoryon-page-redesign-m0NxxV/workspace
pnpm_config_verify_deps_before_run=false NODE_ENV=production node --env-file=/tmp/yoryon-page-redesign-m0NxxV/preview.env -e 'const r=require("node:child_process").spawnSync("pnpm",["build"],{stdio:"inherit"});process.exit(r.status ?? 1)'
```

最终 pnpm build exit 0，日志 build.log。pnpm 11 的自动依赖校验在复制目录中触发重新安装，因非 TTY 安全退出；之后仅禁用这一重复检查，已安装依赖原样复用。会话中断导致隔离 API 停止，首次预渲染 sitemap 的 ECONNREFUSED 回执保留于 build-api-unavailable.log；恢复独立 API 后构建成功。CSS 优化器对原有 ::highlight(search-hit) 给出识别警告，原搜索高亮语义继续保留。

## 重启当前预览

环境与公开数据前提见 environment.json、acceptance-commands.md；随机密钥只保存在 chmod 0600 的临时 preview.env，不进入工件。以下命令需要当前隔离 DB/FS 和临时环境文件仍存在，分别在两个终端运行：

```sh
cd /Users/yoryon/Projects/yoryon/apps/api
node --env-file=/tmp/yoryon-page-redesign-m0NxxV/preview.env --import tsx --input-type=module -e 'import { serve } from "@hono/node-server"; import { createApp } from "./src/app.ts"; import { createDeps } from "./src/deps.ts"; const deps=createDeps(); const app=createApp(deps); const server=serve({fetch:app.fetch,port:deps.env.PORT,hostname:"127.0.0.1"}); for(const sig of ["SIGINT","SIGTERM"])process.on(sig,()=>server.close(()=>void deps.close().finally(()=>process.exit(0))));'
```

```sh
cd /tmp/yoryon-page-redesign-m0NxxV/workspace/apps/web
NODE_ENV=production node --env-file=/tmp/yoryon-page-redesign-m0NxxV/preview.env /Users/yoryon/Projects/yoryon/apps/web/node_modules/next/dist/bin/next start -p 3015 -H 127.0.0.1
```

本次实际 detached 进程 PID 留在临时 api.pid / web.pid；日志为 api.log / web.log。只绑定本机回环。预览副本来源由当前工作区 rsync 复制（排除 node_modules、.next、dist、.env*、.git、artifacts 和 *.tsbuildinfo），各 workspace 的 node_modules 链接到已安装依赖。复生成时可用新临时目录按同样方式复制，再运行项目 build 命令。

## 真实路径验收

独立 agent 验收结论与实际回执见 acceptance.md；本地主要路径 PASS，未覆盖项逐项列明。截图包括桌面首页、订阅、390px/320px、手机菜单、深色及会员各状态。mobile-measurements.json 由根 agent 按独立验收者选定的动作，通过内置 Browser 只读 DOM 采集；独立 agent 看图与回执后判断，不以记录数、构建或 HTTP 成功替代业务结果。

本次没有新增固定测试程序、断言脚本或合成 fixture。验收用户、权益等操作仅发生在隔离环境；清理范围与保留预览环境的销毁命令见独立验收记录。
