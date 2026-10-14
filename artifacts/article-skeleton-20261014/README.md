# 独立文章页 Skeleton Shimmer

用户路径：首页标题/封面点击 → 立即进入独立/p文章页 → 标题/正文骨架横向高光 → 当前权限允许的正文。原“正在打开…”移除。当前用户预览未限速。

实现：文章Link automatic partial prefetch只加载loading壳；no-store当前revision校验在loading边界内执行，再取revision-keyed公共Data Cache。动态正文staleTime0；loading壳static300；没有完整正文预取。/render继续Middleware当前版本门禁。加载失败页内重试，显式重试重新请求整页以清理失败的流式Metadata/RSC状态；404走notFound。Shimmer1.6s、只动画transform，浅深色各自高光强度，reduced-motion关闭动画。

环境与前提：environment.json；隔离数据库yoryon_reading_preview_20261014及25篇公开源。主API4117、Web3117保持运行供用户查看，无生产变更。Source manifest覆盖本轮文件；未提交工作区仍包含前面阅读性能优化。

验证：`pnpm typecheck` PASS；隔离工作区`pnpm build` PASS，日志同目录。独立浏览器/CLI/API真实路径报告在acceptance/README.md，按其记录复现，不维护可执行测试脚本。限制包含未完成预取的极端冷链接：无网络时不能承诺字面零延迟；已预取壳后无需等正文完成即可导航。

启动与重做：读取environment.json的buildWorkspace和envFile。在buildWorkspace/apps/web执行 `NODE_ENV=production node --env-file=<envFile> node_modules/next/dist/bin/next start --hostname 127.0.0.1 -p 3117`。构建在buildWorkspace执行`pnpm build`并通过Node --env-file注入同一隔离配置，`pnpm_config_verify_deps_before_run=warn`仅适用于此临时工作区的依赖链接。停止旧Web再启动，避免端口冲突。

参考设计：[Next 15 loading](https://nextjs.org/docs/15/app/api-reference/file-conventions/loading)、[staleTimes](https://nextjs.org/docs/15/app/api-reference/config/next-config-js/staleTimes)。实际效果以本地浏览器验收为准。
