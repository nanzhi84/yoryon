# 单列信息流本地实现

入口：http://localhost:3015/。保持原阅读宽度，页面与阅读区统一背景；音频入口、播放器及长文预览没有围合卡片底色。日期在上，底部为评论、内容点赞、复制链接转发。使用真实本地 demo 媒体，不使用设计图中的示意风景或虚构互动数字。

源代码版本为 b8e7098e941f80d899cd6483a9ce236732e5ddf6 加当前未提交改动，保留之前已确认的头像/浅蓝品牌设计工作。source-manifest.json 记录工作区与最终预览副本摘要一致性；implementation.patch 保存跟踪文件差异，新增源文件与迁移仍保留于仓库。

设计目标、职责与编码前失败边界见 design.md；交互协议与迁移部署顺序见 ../../docs/content-interactions.md；React 检查见 react-review.md。没有新依赖、固定测试程序或生产测试钩子。

## 实际验证与工件

根工作区 `pnpm typecheck` 通过，typecheck.log 保留最终回执。内置 Browser 实际检查最终页面：页面背景 rgb(253,254,255)、阅读栏透明，容器宽768px/内阅读宽720px；音频入口透明且无边框，播放后的 AudioSkin 与 controls 均透明；真实音频时长3秒并能播放，静音视频预览时长4秒。回执 browser-visual.json、browser-audio.json 与最终截图 browser-home-final.png。实际图集/视频 demo 的测试色条是原媒体，不是新设计装饰。

独立验收最终结论、范围与未覆盖项见 acceptance.md；真实 UI、API、SQL、故障与恢复回执见 acceptance-* 文件。最初发现评论锚点缺失和写失败英文消息，原失败证据保留；补上锚点与中文错误后重新验收。评论仍使用原 TrackClickLink 行为；转发只写剪贴板，不发渠道或转发统计。

## 环境与复现

环境回执 environment.json。只使用隔离 DB `yoryon_page_redesign_20261013`、API4115、FS `/tmp/yoryon-page-redesign-m0NxxV/storage`；私密配置只位于该临时目录的 preview.env（0600），不复制到工件。Web3015运行独立源码副本；原有其他本地服务与生产没有变更。

实际隔离迁移命令（仓库根）：

```sh
node --env-file=/tmp/yoryon-page-redesign-m0NxxV/preview.env --import tsx --input-type=module -e 'if(new URL(process.env.DATABASE_URL).pathname !== "/yoryon_page_redesign_20261013")throw new Error("non-isolated database rejected");await import("./apps/api/src/migrate.ts")'
```

SQL migration 与公开投影回填通过，见 migration.log。新增表为 content_likes；没有迁移源库或生产库。重新运行项目迁移会依账本跳过已应用迁移。

最终构建命令（工作目录取 preview-workspace.txt；依赖链接到当前已安装工作区）：

```sh
pnpm_config_verify_deps_before_run=false NODE_ENV=production node --env-file=/tmp/yoryon-page-redesign-m0NxxV/preview.env -e 'const r=require("node:child_process").spawnSync("pnpm",["build"],{stdio:"inherit"});process.exit(r.status ?? 1)'
```

最终回执 build-native-anchor.log；此前构建日志保留为复验过程证据。仅禁用 pnpm 11 在复制目录的重复依赖安装检查；复用现有实际依赖，没有重新安装包。原有 ::highlight(search-hit) CSS 优化警告仍存在。评论首跳在构建切换后实际丢失 fragment，RSC 缓存与整页退化导航可能有关（推断，具体内部原因未确认）；改用原生锚点导航，同时保留 Click 埋点。

启动 Web（工作目录为 preview-workspace.txt 下 apps/web）：

```sh
NODE_ENV=production node --env-file=/tmp/yoryon-page-redesign-m0NxxV/preview.env /Users/yoryon/Projects/yoryon/apps/web/node_modules/next/dist/bin/next start -p 3015 -H 127.0.0.1
```

API 使用现有 createDeps/createApp 与 @hono/node-server 绑定127.0.0.1；本轮只替换此任务的4115/3015预览进程，PID 与日志路径见 environment.json。复生成需保留隔离环境/存储与私密配置，实际验收动作与数据前提见 acceptance-commands.md。验收结束清理临时用户、评论、赞与权益，保留公开 demo 供用户预览。后续生产发布需要单独授权并先执行迁移。
