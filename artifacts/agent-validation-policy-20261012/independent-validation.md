# 独立子 agent 验收

日期：2026-10-12，Asia/Singapore。版本：HEAD `de8158e73c781ca73f71e11f6566d1ec365241fa` 加未提交清理修改。

范围：删除固定测试入口、断言脚本与发布测试钩子，设置现场子 agent 验收规则；只读验证现有本地预览存活。未创建测试程序、未修改生产数据、未发送邮件、未重启服务。

## 静态结果

- PASS：`pnpm typecheck` exit 0。7 workspace projects，6 子项目执行 tsc --noEmit，全通过。pnpm 自动 supply-chain 检查曾出现 registry ECONNRESET 有界重试，最终通过。
- PASS：`git diff --check` exit 0。
- PASS：`rg --files apps packages deploy | rg '(\.spec\.|\.test\.|verify-|playwright|fixture|harness)'` 未发现当前可执行固定测试入口。
- PASS：扫描 apps/packages/deploy、根 package/workspace、README、部署文档，未发现 BLOG_PUBLISH_TEST_HOOK、BLOG_TEST_SIGNAL_DIR 或 @yoryon/e2e 当前入口。
- PASS：锁文件无 e2e importer 与 Playwright resolved binding；仍有 Next 15.5.27 自身的 optional @playwright/test peer 声明，属于上游元数据。
- PASS：AGENTS.md 要求每次变更独立子 agent，按真实用户路径和失败边界现场验收，记录 PASS/FAIL/UNVERIFIED/UNKNOWN、脱敏工件与未覆盖项，静态检查不代表业务通过。
- PASS：已独立指出并由主 agent 修正 architecture.md 迁移段、权益缓存段及 deploy-neon.md 当前 E2E 口径；最终重新扫描这三份文档与 README 无 E2E/e2e/测试钩子残留，git diff --check 再次 exit 0。

## 只读现场结果

环境：既有 localhost:3100 服务，既有隔离文章 `/p/article-highlight-1791808914461`；内置 @Browser 新建隐藏临时标签，验收后关闭。该服务运行旧构建，本结果仅证明原预览仍存活，不证明修改后发布代码的业务通过。

- PASS（旧预览存活）：文章标题、行内 state、Python、JS 和两个纯文本代码块可见，中文注释与 4 空格缩进保留。`<script>alert(1)</script>`、`<b>`、反引号作为代码文字呈现。
- PASS（旧预览存活）：经“切换主题 → 深色/浅色”真实 UI 路径切换；浅色背景 rgb(246,248,250)，深色背景 rgb(36,41,46)，关键字、函数、字符串有区别颜色。
- 证据：preview-light.png、preview-dark.png、preview-light.json。截图只有本地合成公开文字，不含认证凭据。
- UNVERIFIED：清理后的代码重新发布、上传/事务/GC/锁竞态、授权、邮件、迁移、生产部署；此次没有修改这些业务语义，移除钩子的差异仅删除测试分支。
- UNKNOWN：线上发布 SHA 与部署状态，未查询。

## 可重复执行的方法

在该仓库执行 `pnpm typecheck`、`git diff --check`，扫描当前源目录、根脚本、workspace 与 lockfile；用独立子 agent 新建内置浏览器标签读取现存隔离预览，现场观察正文与主题交互，保存截图与命令回执。不得把历史截图或旧构建浏览器结果作为修改后业务验收。
