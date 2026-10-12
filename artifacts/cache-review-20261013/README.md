# PR #19 独立审查及现场复核

审查时间：2026-10-13，Asia/Singapore（JSON 原始回执为 UTC）。审查者为独立子 agent，未修改生产源码。审查 head：`a84ce7d6c377db8fad6ddb579557b8b4e8a2c670`；base：`696ba1597fe88e702f48ae6c86fdd13c57bd95da`。远端 `gh pr view 19 --repo nanzhi84/yoryon --json headRefOid,baseRefOid,files,statusCheckRollup` 已核对 head/base 一致；检查项为空，不声称 CI 通过。

结论：**在本 PR 的代码合并范围内未发现阻断项，可合并。** 已复核旧证据并以当前精确 head 在独立环境补验。平台 CDN/Full Route Cache 与完整跨部署升级仍 UNVERIFIED；本结论不能代替这些生产验收，也不能据此把相关业务范围全部写成完成。

## 环境及数据前提

- 独立 detached worktree：`/tmp/yoryon-cache-review-20261013`；Node v24.20.0、pnpm 11.8.0、Next 15.5.27；`pnpm install --frozen-lockfile` 按现有 lockfile 完成，未改 lockfile。
- 独占 Docker `postgres:16` 容器 `yoryon-cache-review-pg-20261013`，仅映射 `127.0.0.1:55449`，空库 `yoryon_cache_review`。只在此库运行现有 migrations。
- API `127.0.0.1:4449`；真实 production `next start` `localhost:3149`；隔离 FS `/tmp/yoryon-cache-review-media`。
- `.env` 随机本地密钥、独立数据库口令，不提交、不记入工件。API_INTERNAL_URL/API_PUBLIC_URL 指 4449，SITE_URL/ALLOWED_ORIGINS 指 3149；FEED_REVALIDATE_SEC=86400；CACHE_REVALIDATE_URL 为空；MAIL_SMTP_HOST=127.0.0.1/PORT=59998，未运行 SMTP、未发邮件。
- 实际 CLI 发布 24 篇临时合成文章 review-00..23，相同 published_at `2026-10-01T12:00:00.000Z`，tag `review-tag`，全文/预览标记 REVIEW_VISIBLE_N 与 REVIEW_RESTRICTED_N；未读取真实账户、正文、媒体或生产数据库。

## 当前现场结果

| 范围 | 结果 | 可核对证据 |
|---|---|---|
| 静态检查及生产构建 | PASS，均实际运行；首页/tag 构建为动态，内部正文及分页仍静态缓存路径 | typecheck.txt、build.txt |
| CLI 发布、缺失事件投递配置 | PASS，真实落库，事件保持 pending(configuration missing)，未报告已验收 | publish.txt |
| SQL 无事件撤销已缓存全文 | PASS，预热全文两次，SQL paid/marker + 新 revision，事件数保持 25；旧 render 404/private no-store；canonical 200 仅预览；公开 API preview；检查实际正文标记 | sql-revocation.json、browser-preview.json、browser-preview.jpg |
| 失败投递后 pin、浏览器恢复 | PASS，旧已打开页面点加载更多出现“列表已更新。刷新列表”；真实点击刷新后目录 version 变更，review-14 为首项并有置顶标志；再次点击加载更多完成全部 24 条且无刷新提示 | pin.txt、browser.json、browser-recovered.jpg |
| Feed 相同毫秒全序及分页 | PASS，API 20/4 与独立 SQL 全序逐 ID 一致；24 unique，无重漏；最后 nextCursor=null；旧 version API 409 | pagination.json |
| API 单独退出，保留已缓存 Next | PASS（HTTP 用户路径），已预热全文两次；SIGTERM 仅退出 API 后 canonical、当前 render 和缓存分页均 503/private no-store，无正文，耗时 22/4/3ms | api-exit.json |
| API 退出后的浏览器错误页 | UNVERIFIED；内置 Browser 导航报 `net::ERR_BLOCKED_BY_CLIENT`，保持原预览页；没有把 HTTP 503 回执冒充浏览器渲染 | 本报告 |
| 现场 tag 分页、旧两字段游标、成功投递并发及旧缓存植入 | 本轮未重新执行；源码与历史原始回执复核，见下方范围 | PR 原工件 |
| 平台 Full Route Cache/CDN、完整旧发布物跨部署升级 | UNVERIFIED | 不由本机 Data Cache 结果推断 |

## 架构及正确性审查

使用 `/Users/yoryon/.codex/skills/architecture-review/SKILL.md`（只读）并做一般代码审查。检查模块依赖方向、缓存与身份边界、事务快照、失败关闭、并发恢复、相关 ADR，以及部署配置。host rendering: not available。

- `apps/api/src/public-policy.ts:35-44`：正文门禁直接读已提交 status/revision，目录版本直接读 DB 事件；不使用旧内存快照兜底。SQL 权限修复轮换 revision 后无需事件送达即可阻断旧缓存。图片目录依旧由原有 refresh 队列维护，本 PR 未扩大图片权限保证。
- `apps/web/middleware.ts:24-37`：canonical 在共享正文缓存前检查当前 revision，并改写到不可变 UUID key；直接旧 render 同样检查。API 退出时已缓存全文不能绕过门禁。收紧前已获准的在途响应可完成，不能描述为撤回已发送数据。
- `apps/api/src/routes/contents.ts:95-139` 及 tag handler：目录版本、记录及关联标签来自同一 repeatable-read 只读事务，避免混合快照。支持写路径 publish/pin/unpin/unpublish/delete/cache refresh 均在事务开始前持有统一发布锁，事件与业务修改原子提交。任意绕 CLI 的 SQL 排序改动仍须 cache refresh；不删除生产版本事件，不将直接改 visibility 且保持 revision 描述为安全编辑路径。
- `apps/web/lib/public-catalog.ts:4-15`：首屏实时选择目录版本，协议 `pin-v2` 使旧无参数两字段 Feed Data Cache 键无法复用；409 至多重试三次，每次 no-store 目录查询 URL 独立，避免同一次 React 渲染的 GET 去重保留旧版本。只有首页和 tag 使用该 helper，没有新建 web→DB/core 依赖或循环依赖。
- 缓存仍分公开与私有两线：公开 fetch 不转发 cookie/IP，正文公开投影仍传 null viewer；带身份私有线继续 no-store。Feed/tag 从 Full Route Cache 退出，保留版本化 Data Cache；新增轻量 DB 请求是明确代价。
- 两个 vercel.json 仅禁用 `fix/cache-permission-feed-recovery`，未禁用 main。已按 [Vercel 官方 Git configuration](https://vercel.com/docs/project-configuration/git-configuration) 确认 `git.deploymentEnabled` 未指定分支默认 true。平台生产构建及域名路径未在本轮运行。

| ADR | 状态 | 说明 |
|---|---|---|
| ADR-0001 BFF | PASS（源码） | 没有新增身份转发路径 |
| ADR-0003 缓存分线 | PASS（源码 + 限定用户路径） | 公开投影身份无关，私有线仍 no-store |
| ADR-0010 发布缓存生命周期 | PASS（限定代码范围） | outbox/版本键/门禁职责保持；实时 SQL 比旧内存门禁更严格。生产门禁/CDN尚需独立验收 |

非阻断维护观察：列表版本仍依赖事件历史与受支持的串行 CLI 写入协议；正文 SQL 修复必须轮换 revision（通常执行 cache refresh）。当前 PR 文档已明确这些边界。

## 历史证据复核

已读取 PR 中 `artifacts/cache-feed-followup-20261012/README.md`、acceptance.md、race.md、review.md，以及原始 race-success-receipt.json、race-success-cache.json、database-failclosed.json、browser-cursor.json、legacy-data-cache.json、environment-cleanup.txt。成功投递并发回执的 verified=15:51:10.106Z，CLI completed=.181Z，旧 full Data Cache mtime=.188Z，确实晚于 refresh；后续旧 key 404、新 canonical 仅预览。旧两字段浏览器回执 400→刷新→200，旧键植入保留但未命中。它们是历史独立执行结果，本轮只审查证据与当前代码，不把这些执行记成自己的新增运行。

## 实际入口命令与临时操作

参见 commands.md。没有新增可执行测试脚本、固定测试套件或 harness。第一次内联复核从 workspace 根 `import 'pg'` 无法解析（pg 是 packages/db 的依赖）；更正为 Node createRequire 指向 packages/db/package.json 后完成复核，这是审查工具调用错误，非产品失败。

清理前库仅有本次 24 篇文章、25 个事件、0 用户；已删回 0/0/0，见 cleanup.txt。服务、配置与独占容器清理结果见 environment-cleanup.txt。主 agent 负责合并与合并后 exact ref/部署核对。
