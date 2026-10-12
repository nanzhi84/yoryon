# Issue #14 收尾交付记录

日期：2026-10-13（Asia/Singapore）。起始实现版本 `ff84d8024b1a7c9acc68def07b7d78e3abc3777b`，基于 main `696ba1597fe88e702f48ae6c86fdd13c57bd95da`。本目录提交中的实现文件 SHA256 见 `source-sha256.json`。

## 变更合同

- 根分页绑定作品与排序版本，同一短期 repeatable-read 快照内读取。根新增、删除或排序字段变化由数据库触发器递增；旧版本请求返回 409 `cursor_stale`。前端丢弃该排序序列，重新读取首页并显示排序变化提示。未保留跨页历史快照，持续排序变化可能反复重载。
- 通知角标在已读成功事件、页面切换和窗口激活后重读权威私有计数；401 清入口，取消旧请求并拒绝迟到响应。身份组件可以调用 `notifyNotificationsChanged()`。
- 评论创建请求在 BFF 和 Hono 都有 32 KiB 字节上限，覆盖 chunked；正文仍为 1–2000 Unicode 码点纯文本。
- 评论展示入口接受 article/post；post 的发布与内容类型迁移由 Issue #18 整合。

## 环境与实际检查

全部使用 `/tmp/yoryon-accept-comments/env.sh`，未输出密钥。PostgreSQL `localhost:54329/yoryon_accept_comments`，API `127.0.0.1:4323`，生产模式 Web `localhost:3103`，本地 SMTP/Mailpit。未访问生产数据库、修改生产业务数据或发送真实用户邮件。本轮未创建用户、权益、会话或邮件。

| 检查 | 判定 | 证据与范围 |
|---|---|---|
| 项目构建 | PASS | `source /tmp/yoryon-accept-comments/env.sh && pnpm build`；`build.txt`。完整工作区构建，使用可用隔离 API。 |
| 静态检查 | PASS | 在构建完成后串行 `pnpm typecheck`；`typecheck.txt`。不代表业务验收。 |
| Drizzle 0008 迁移 | PASS | `pnpm exec tsx -e 'import {runMigrations} from "./packages/db/src/migrate.ts"; runMigrations(process.env.DATABASE_URL!, "packages/db/drizzle")'`，先校验端口 54329 与数据库名；只在隔离库运行。迁移记录实际为 9 条。 |
| 数据库触发器与级联 | PASS（边界探查） | 一次性 SQL 事务，新增自身 draft 作品/根/回复；根插入版本 1、根赞数改变版本 2、回复插入与点赞保持版本 2；删除自身作品后评论和版本均无残留。最终 ROLLBACK。`migration-probe.txt`。该 SQL 构造不代替用户点赞验收。 |
| 公开分页读取 | PASS（静态数据范围） | 新生产 BFF 首页 20 条、下一页 18 条、无重复；游标含作品 ID/version=0，公开缓存头不含私有状态。`read-and-body-limit.txt`。不据此声称并发排序通过。 |
| 流式请求体上限 | PASS | 匿名 40000 字符 JSON 用 ReadableStream、无 Content-Length，直接 API 与 BFF 均 413 `payload_too_large`；未写评论。`read-and-body-limit.txt`。 |
| 新增浏览器行为 | UNVERIFIED（待独立代理） | 外部点赞使游标失效后的 DOM 重载、失效后 GET 失败/重试、角标已读与注销、迟到计数响应；由父流程另安排独立 review/验收。 |

现场探查为内联 heredoc，未新增固定套件、脚本、harness 或可执行验收程序。API/Web 在构建后重启到本轮 bundle；启动前确认原 PID 的 cwd 都在此工作树，仅关闭该隔离 API/Web。

## 既有证据与失败留存

`comments-accept-20261012`、r2/r3/r4 为已有提交证据。起始未跟踪的 `comments-accept-r5-20261012` 全量保留并纳入本次提交；它只证明 ff84d80 当时所验收的范围，不能用于证明新增逻辑。r5 原报告引用的 `final-safety-check.txt` 与 `SHA256SUMS.txt` 未存在于交接工作树；未补写历史结果。本轮另生成 `historical-r5-SHA256SUMS.txt`，从仓库根可用 `shasum -a 256 -c artifacts/comments-delivery-20261013/historical-r5-SHA256SUMS.txt` 核对当前保存的 r5 文件。

两次实现期工具失败：首次 Drizzle generate 对 bigint `.default(0n)` 报 `TypeError: Do not know how to serialize a BigInt`，改为 SQL literal 默认 0 后重新生成成功；首次 `tsx -e` 迁移命令包含 top-level await，解析时报 CJS 不支持，该次未连接数据库，移除 top-level await 后迁移成功。无业务写入重发。构建因随后补请求体上限与代码命名调整而重新执行，最终日志仅对应最终源码；每次构建后才运行 typecheck，避免 `.next/types` 构建竞态。

工件文本敏感标记扫描见 `sensitive-scan.json`。原 r5 图像/真实业务判断由当时独立代理记录，本收尾不扩张其结论。独立代码 review、当前版本浏览器验收、CI 和合并状态由父流程汇总。
