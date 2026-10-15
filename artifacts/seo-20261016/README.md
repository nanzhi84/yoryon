# SEO 优化交付与验收

日期：2026-10-16（Asia/Singapore）。基础提交 `20c1bd31d5d2abc09d1b0fc5c66bbd9c362b00d0`。

## 变更范围

- 首页、帖子、合集、标签及对应详情页统一 canonical 与公开 SEO description。
- 搜索、登录、注册、重置密码、兑换、通知、个人资料使用 noindex, follow。
- 基于页面现有公开元信息生成作者、文章规范页面/合集关联、合集目录 JSON-LD；统一安全转义。
- sitemap 继续使用同一个公开 API，仅保留规范内容/合集路径，去重并统一域名。
- 核对确认 updatedAt 混合了内容与缓存/管理修改，因此省略可选 lastmod/dateModified，保留真实 datePublished。
- 不改变 API、数据库、正文、媒体、页面可见布局、权限或请求链路。工作区原有其他改动不纳入本次提交。

设计与边界：`docs/seo.md`。

## 本地检查与隔离验收

- PASS：`pnpm typecheck`（typecheck.log）。
- PASS：`pnpm build`（build.log），使用专用隔离 API/配置。
- PASS：`git diff --check`。
- 独立审查与真实 HTML/API/SQL 结果：`acceptance/independent-acceptance.md`。
- 浏览器视觉/交互：UNVERIFIED。主代理 IAB 新建/读取页面 AX/DOM 持续 30 秒超时；CUA Chrome 不可用。未以纯 HTML 或构建成功替代浏览器验收。

运行前提：本机 PostgreSQL 16 的既有隔离库 `yoryon_page_redesign_20261013` 与其独立 FS 媒体。专用数据库 `yoryon_seo_20261016`、API `127.0.0.1:4116`、Web `localhost:3216`；SMTP 指向无服务端口，不能向真实用户发信。临时配置 `/tmp/yoryon-seo-20261016/acceptance.env` 不入仓库；准备/数据回执详见独立报告。

实际构建/运行命令：

```sh
set -a
source /tmp/yoryon-seo-20261016/acceptance.env
set +a
pnpm typecheck
pnpm build
pnpm --filter @yoryon/web exec next start -p 3216
```

## 发布

发布前生产部署：`dpl_GFjj2oxssGicJSwe2Nwn7PUwKnrf`（production-before.txt）。

提交后从该提交的 git archive 创建干净发布目录，复制已确认项目的 `.vercel/project.json`，先以 Production 环境 `--skip-domain` 构建，再检验并 promote。不上传未提交工作区、隔离配置或受限素材；不发布 API/数据库变更。

最终提交、暂存/正式部署、生产只读独立验收与回滚地址将在 release.md 记录。

搜索引擎实际重新抓取、采用 canonical、去除旧收录及排名变化为 UNKNOWN，需要后续在搜索引擎管理平台观察；本次不声称已完成收录或提升排名。
