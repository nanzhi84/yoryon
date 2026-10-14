# 后端实施回执

基线：7124e919511e27c97c9a6417a92097aae5a1ce3a；分支 codex/issue-26-collections；日期 2026-10-15（Asia/Singapore）。Node/pnpm 使用项目已安装运行时。

命令：`pnpm --filter @yoryon/core --filter @yoryon/db --filter @yoryon/api --filter @yoryon/cli typecheck`

结果：PASS。4 个包的 `tsc --noEmit` 均退出 0。执行两次：完成API实现后及文档/缓存分块修改后。本回执只证明静态类型检查，不代表迁移、媒体字节、缓存、浏览器或授权业务验收；业务验收由独立 review_26 子 agent 执行。

生成迁移命令：`pnpm db:generate --name=collection_reading`。与并行 Issue #27 保留 0013 的约定下，生成结果重命名为 0014_collection_reading.sql / meta/0014_snapshot.json，并更新 journal idx=14；迁移额外显式保留原首页 public-only 的存量可见性及回填真实合集更新时间。主 agent 合并 #27 时需整合 snapshot prevId 与 journal 顺序。

实现接口：

- CLI `content home/hide <slug>`；frontmatter `show_in_home` 可选；既有缺省重复发布保留数据库值。
- CLI `collection cover <slug> <file>` / `clear-cover <slug>` / `pin <slug>` / `unpin <slug>`。
- GET `/api/collections` / `/api/collections/:slug` 增加 isPinned、updatedAt、cover 元数据；目录章节返回稳定 id。
- GET `/api/collections/:slug/chapters/:contentId` 校验当前已发布成员并返回 canonical collection、chapter、previous、next，无正文与权益凭证。

已授权范围内没有生产数据读取、生产业务写入或部署；没有新增固定测试程序或单元测试。媒体GC及匿名封面授权复用已有语义。覆盖 CLI 撤回/删除同事务刷新全部旧所属合集；资料/排序缓存按90章分块，防止超过100-target协议上限。
