# #10 / #13 补充修复验收

基准：`696ba1597fe88e702f48ae6c86fdd13c57bd95da`（已合并 PR #16/#17）。业务提交：`f166cc6ad419df1dc4b3844e5e29d1cd64c3e1d5`。本目录仅记录本次隔离现场验证，不是固定测试入口。

结论：限定修复场景现场通过，独立审查无阻断项。成功与失败投递下的旧渲染跨刷新窗口、真实 86400 秒 Data Cache、旧键保留模拟与旧游标浏览器恢复均有回执。未验证平台 Full Route Cache/CDN、完整旧发布物跨部署及 API 进程单独退出；不将这些范围写为通过。105 条耗尽事件不阻塞新事件，人工重试本批恢复 100 条，剩余条目随本次隔离数据清理，未声称全数恢复。

## 环境与命令

- Node v24.19.0，pnpm 11.25.0，Next 15.5.27；依赖按现有 lockfile 安装，未改 lockfile。
- 独占 Docker 容器 `yoryon-review-pg`，postgres:16（镜像 digest `sha256:ca0bd484cb98bf4b24eb1010e73fb3fcbd6714d240fbc1a10eea5b7dbecb641d`），仅监听 `127.0.0.1:55439`，库 `yoryon_review`。没有连接生产数据库。
- 本地 API `127.0.0.1:4439`；生产构建 Next `localhost:3139`；存储 `/tmp/yoryon-review-media`；SMTP 指向未运行的本地端口 59998，未发送邮件。
- `.env` 为本次本地合成配置，不提交：DATABASE_URL 指上述隔离库，STORAGE_BACKEND=fs；API_INTERNAL_URL/API_PUBLIC_URL 指 4439；SITE_URL/ALLOWED_ORIGINS 指 3139；CACHE_REVALIDATE_URL 指本地 `/api/revalidate`；FEED_REVALIDATE_SEC=86400；BFF、存储、缓存签名均使用独立本地值。缓存签名密钥需至少 32 字符；首轮本地配置不足引起的 403 已记录并更正，成功投递路径在更正后重新验收。

实际执行的基础命令：

```sh
pnpm install --frozen-lockfile --store-dir /tmp/yoryon-pnpm-store
pnpm db:migrate
node --import tsx --env-file=.env apps/api/src/index.ts
pnpm typecheck
set -a
source .env
set +a
pnpm build
# 在 apps/web 下，继承同一隔离配置：
node --inspect=127.0.0.1:9239 node_modules/next/dist/bin/next start -p 3139
```

迁移只在新建空隔离库运行，没有新增生产 migration。Inspector 只在本地开启，用于现场控制旧渲染窗口；未增加生产测试钩子。内置 Browser 工具不可用，独立验收改用已安装 Playwright 与 `/usr/bin/chromium`。

## 证据导航

- `typecheck.txt`、`build.txt`：全量静态检查与构建成功。构建结果首页/tag 为动态页面，版本化列表和公开正文保留共享 Data Cache；不能以此代替业务验收。
- `acceptance.md` 及其引用回执：独立 CLI/API/浏览器现场验收、共享缓存与失败投递。
- `race.md`、`race-receipt.json`：通过调试器控制旧渲染跨刷新窗口。
- `review.md`：独立审查者对最终差异与证据的审查。
- `environment-cleanup.txt`：最终全库 contents/cache_events 均为 0；关闭本次 API/Next，销毁独占 PostgreSQL 容器，删除本地配置、合成共享缓存及媒体目录。

## 维护边界

正文门禁现在每个请求读取当前数据库 status/revision，目录门禁读取当前已提交事件版本。增加了轻量数据库读取；数据库/策略不可用时既有 middleware 返回 503，不使用旧权限兜底。Feed/tag 页退出 Full Route Cache，保留按协议及版本缓存的列表数据。当前版本协议依赖既有 CLI 事务与发布锁；任意绕过 CLI 的 SQL 排序修改仍须执行 cache refresh。

已在数据库修改前获准的在途响应可完成；修复保证的是撤销提交后开始的新请求不能通过旧 revision 门禁，不撤回用户已下载的内容。本轮不改图片目录权限、权益产品或 Issue #14/#15/#18。

首次推送携带仓库根及 apps/web 的 vercel.json，以官方 `git.deploymentEnabled` 精确禁用 `fix/cache-permission-feed-recovery` 分支自动部署，main 不受影响。只读项目摘要未提供最新 rootDirectory；历史记录为 apps/web，双位置覆盖该目录与仓库根。远端 SHA、检查及部署查询结果见 PR 交付记录；不会将没有检查项表述为 CI 通过。
