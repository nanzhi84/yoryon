# 实现回执（独立验收前）

2026-10-15（Asia/Singapore）。分支 `codex/issue-27-visitors`。未部署、未生产写入、未发送邮件。

环境：PostgreSQL 16 本地容器 `deploy-postgres-1`，独立数据库 `yoryon_issue27_20261015`；API `http://localhost:4027`，Web `http://localhost:3027`。独立配置 `/tmp/yoryon-issue27-20261015/runtime.env`，文件权限 0600，不继承仓库或生产 `.env`；隔离 fs 存储 `/tmp/yoryon-issue27-20261015/storage`。SMTP 仅本地 Mailpit，本次不走邮件路径。

数据前提：空独立数据库应用完整迁移至 `0013_anonymous_visitors`；CLI 创建 `visitor-check` 合集并发布同 slug 的公开文章，无媒体与真实账号。缓存投递提示 configuration missing，因此只证明数据库发布完成；开发服务器通过 `FEED_REVALIDATE_SEC=0` 读取本地数据。

实际命令与回执：

```text
pnpm install --frozen-lockfile
  PASS：锁文件未改，依赖安装完成。
pnpm db:generate
  PASS：生成 0013（重命名 anonymous_visitors），拆 schema 后再次执行显示 No schema changes。
pnpm typecheck
  PASS：全部 workspace tsc 通过（见 typecheck.txt）。这不是业务验收。
env -i PATH="$PATH" HOME="$HOME" pnpm exec tsx --env-file=/tmp/yoryon-issue27-20261015/runtime.env apps/api/src/migrate.ts
  PASS：SQL migrations and public preview backfill applied；空库 searchProjections=0。
env -i PATH="$PATH" HOME="$HOME" pnpm exec tsx --env-file=/tmp/yoryon-issue27-20261015/runtime.env apps/api/src/index.ts
  已启动 API4027。
# apps/web 工作目录
env -i PATH="$PATH" HOME="$HOME" node --env-file=/tmp/yoryon-issue27-20261015/runtime.env node_modules/next/dist/bin/next dev --port 3027
  已启动 Web3027。
# 仓库根目录
env -i PATH="$PATH" HOME="$HOME" pnpm exec tsx --env-file=/tmp/yoryon-issue27-20261015/runtime.env apps/cli/src/index.ts collection create visitor-check --title '访客隔离验收' --description '仅本地隔离数据'
env -i PATH="$PATH" HOME="$HOME" pnpm exec tsx --env-file=/tmp/yoryon-issue27-20261015/runtime.env apps/cli/src/index.ts publish /tmp/yoryon-issue27-20261015/content/visitor-check
  隔离数据入库完成；缓存缺省配置边界见上文。
env -i PATH="$PATH" HOME="$HOME" pnpm exec tsx --env-file=/tmp/yoryon-issue27-20261015/runtime.env apps/cli/src/index.ts analytics overview --days 7
env -i PATH="$PATH" HOME="$HOME" pnpm exec tsx --env-file=/tmp/yoryon-issue27-20261015/runtime.env apps/cli/src/index.ts analytics visitors --days 7 --limit 20
  PASS（空事件窗口）：coverage=N/A，unique/new/returning=N/A，无可识别访客；未把不可计算写成 0。
git diff --check
  PASS。
```

浏览器 → API → 数据库 → CLI 业务验收：UNVERIFIED，交由独立子 agent。窗口边界、持久首次观察/原始 prune、禁用存储、DNT/GPC、重复重试、并发首次初始化等尚需独立现场验证。构建将使用隔离 API/config 执行；生产验收与部署不在授权范围内。

合并配置：`apps/web/vercel.json` 增加 `git.deploymentEnabled.main=false`，保留已有分支规则，以满足本次仅 merge、暂不部署生产。

独立验收结束后由验收者清理本运行创建的数据库、浏览器上下文与临时存储。工件仅保留脱敏命令回执及聚合结果，不保留访客 UUID 或凭证。
