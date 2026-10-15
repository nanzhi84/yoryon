# Issue #26 合集封面设计独立复核

- 日期：2026-10-15（Asia/Singapore）
- 验收者：独立子 agent `verify_cover_issue`
- 版本：本地 HEAD `7124e919511e27c97c9a6417a92097aae5a1ce3a`；核验对象为 GitHub 当前 Issue 正文。
- 环境与数据前提：使用已认证的 GitHub CLI，仅只读获取 `nanzhi84/yoryon` 的 Issue #26；无数据库、存储或业务数据变更。
- 实际命令：`gh issue view 26 --repo nanzhi84/yoryon --json body`（退出码 0）；`git rev-parse HEAD`（退出码 0）。

## 结果

| 范围 | 结果 | 正文证据 |
| --- | --- | --- |
| 合集封面存储 | PASS | 明确“合集封面文件存储在 OSS”，复用媒体上传、内容寻址去重和媒体访问链路。 |
| 数据库关联 | PASS | 明确数据库仅保存媒体元数据与 `collections.coverMediaId`，不保存图片字节或临时签名 URL。 |
| 更换、故障及缓存 | PASS | 先上传，再事务更新封面关联与更新时间并使缓存失效；失败保留原封面；共享引用沿用引用计数与 GC。 |
| 权限边界 | PASS | 公开介绍封面通过 `/api/media/:id` 获取短期 OSS 签名 URL；桶保持私有；会员正文及受保护媒体权限保持。 |
| 原有设计参考 | PASS | 两张原有图片链接仍保留：`docs/design/issue-26/collection-tab-v2.png` 和 `collection-detail-v2.png`，引用提交 `ca14b57d9d6a19d9945f97c26b926ab6938ef12c`。本次未重新请求图片字节。 |
| 单按钮续读 | PASS | 仍明确无有效记录显示“开始阅读”、有记录显示“继续阅读”，始终仅一个按钮，并保留 localStorage 与章节导航规则。 |
| 互动范围 | PASS | 仍明确合集不提供评论、点赞、分享，仅单篇作品保留现有互动。 |
| 新增验收要求 | PASS | 明确覆盖 OSS 媒体字节、匿名最终展示、私有桶、受保护资源、更换、共享引用、失败、缓存及无封面。 |
| 运行态行为 | UNVERIFIED | 本轮为设计文档修改，未执行上传、数据库查询、缓存、权限或浏览器业务验收，不能据此声称功能已实现。 |

整体结论：Issue 文档变更 PASS；没有发现破坏原有两图、续读或互动规则的正文变化。仅新增本地验收工件，未创建验收业务数据，无须清理数据。
