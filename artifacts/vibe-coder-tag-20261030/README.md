# Vibe Coder速成科普系列标签

用户授权给系列统一添加标签。生产库与公开快照确认当前仅有已发布《Vibe Coder速成科普（1）：计算机网络》，Notion 中其他近似标题未因此发布。

标签 slug 为 vibe-coder-crash-course，name 为 Vibe Coder速成科普。使用本机受保护 CLI 配置通过参数化 SQL，在单事务中获取既有发布/GC advisory lock，仅 upsert tags 和插入 content_tags，已有标签保留。目标旧标签备份 before.json；变更回执 mutation.json。不修改正文、时间、权限或媒体；静态站不依赖旧动态缓存。后续通过 pnpm static:export 保持数据库与站点一致。

发布源 /Users/yoryon/Projects/yoryon/artifacts/network-article-sync-20261030/post/index.md 已补充 tags: [vibe-coder-crash-course]，docs/static-site.md 记录统一命名约定，避免重新发布丢失标签。

环境与复现：仓库固定 Node/pnpm；导出需 ~/.config/yoryon-production/ 下受保护配置；静态构建无生产凭据。运行 pnpm static:export、pnpm typecheck、pnpm build、pnpm preview --port 3103；打开 /tags/，点击系列标签，再点击文章检查全文与图片。无新增测试数据或固定测试程序。

回滚：按 before.json 仅移除本次 content_tags 关联，重新导出部署；若标签仍被其他内容使用不删除标签。未执行。

本地 typecheck/build 均通过。主 agent 用独立 headless Chromium 1248 真实点击 /tags/ →系列标签→文章，确认标签中文标题、唯一目标文章链接、完整标题/五张图注/结尾均正确（browser-result.json、tag-page.png）。内置浏览器不可用；子 agent 独立核对静态差异、生成HTML和浏览器工件，见 independent-acceptance.md。正文及其他文章不变由 independent-diff.json 记录。
