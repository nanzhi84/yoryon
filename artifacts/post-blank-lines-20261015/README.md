# 短帖空行保留

2026-10-15，当前未提交工作区。环境见environment.json：本地隔离API4117、网页3117、编辑器3118，用户已修改/未保存的稿件均不由本次变更改写。

实现：保留Markdown源行位置，对短帖块之间的实际空行按正文行高计数；信息流每空行24px，详情按自身行高。单个终止换行不算额外空行。普通换行、硬换行仍沿用既有处理。文章未启用该模式。

验证命令：仓库 `pnpm typecheck` PASS；使用隔离API配置在environment.json的buildWorkspace执行 `pnpm build` PASS；`git diff --check`。完整日志typecheck.log、build.log。独立验收在新标签编辑但不保存，不修改用户稿件。

用户当前编辑器有未保存文本，主agent只读取状态，未刷新用户页；用户应先保存后刷新以加载新渲染。

独立实际浏览器几何测量、源码/搜索节点对照与截图见acceptance/。
