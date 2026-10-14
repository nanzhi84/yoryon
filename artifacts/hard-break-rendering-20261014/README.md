# Markdown硬换行重复显示修复

用户截图证明此前只核对p/br不足以验证视觉。根因：remark-rehype硬换行生成br和后续text首newline；搜索装饰span的white-space:pre-wrap又显示此newline，形成额外空行。

边界：仅Web渲染，不修改正文或生产内容，不调整行高/段距，不改搜索索引协议/offset。新增rehypeHardBreaks在rehypeSearchText之后，仅对紧邻br的search span首text隐藏首个newline。内部hidden aria-hidden span仅含该newline，原完整textContent、data-search-node id及UTF-16偏移保持；正文后续文字正常显示，pre不递归，soft break和NBSP真空段保留。文档同步docs/markdown-rendering.md。无需DB/API发布或迁移。

实际命令：pnpm typecheck（typecheck.log）；git diff --check。独立agent先记录失败方式与边界design-acceptance.md，再核对行为和隔离pnpm build。现场内联命令及结果、限制在acceptance.md。无新增固定测试程序、业务数据，不发邮件。先前8条真实已发布稿用于核对，不是合成测试套件。

浏览器限制：主agentIAB新建独立详情30秒超时；尝试专用Chrome会话返回Browser is not available: chrome。未使用用户Chrome现有标签或登录状态。真实像素与点击无法验证，不能把HTML结构证据描述为视觉通过。

生产项目yoryon-web/team_QZe9hRamSsGyB0AEDzsHIb5v，源提交后push main由Git集成部署；部署前previous-deployment.json为回滚点，最终deployment.json和production-deployment.json验证READY及域名。仅前端及渲染文档，无内容再发布。

源码17f5250b4625963bf3a8c415da5cec36fbb4fba2已推送origin/main；Git集成构建yoryon-9wh3107wa。现场SSR与编译CSS复核确认hidden规则display:none!important；每个硬换行仅隐藏其后的一个格式newline，原br仍存在。此为渲染结构与CSS规则证据，不等于浏览器像素截图。

最终production deployment dpl_AeAcG44PnZwqPYPsSsRPwuRJVhiu READY，production-deployment.json确认yoryon.com指向。主agent普通URL检查04.21详情实际输出两个br，各自后面的换行仅在hidden aria-hidden内部span中，正文仍逐行。primary-production-post.html保留响应。未改DB/内容/日期。
