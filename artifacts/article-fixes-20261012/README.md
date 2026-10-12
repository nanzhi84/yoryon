# 三篇文章格式与图片验收（2026-10-12）

目标：移除 Jev 正文开头日期，正确渲染中文加粗与行内代码，减小公开图片体积并复用 CDN/浏览器字节。三篇继续公开免费，写作日期元数据保留。

## 复现与环境

- `pnpm typecheck`
- `pnpm e2e`：本机 Node/pnpm/Docker，隔离 PostgreSQL、FS 图片存储、Mailpit、API、Next 与启用 gzip/zstd 的 Caddy。测试数据由测试准备流程重置，禁止连接生产数据库。
- `YORYON_SVG_TARGET=<候选部署URL> node artifacts/article-fixes-20261012/verify-svg-candidate.mjs`：已登录 Vercel CLI，仅匿名读取正式公开的 Jev 五张图；候选需配置生产 API 回源。
- `pnpm exec tsx deploy/verify-notion-publication.ts`：读取三篇公开正文和原图，与 `artifacts/notion-publication-20261012/manifest.json` 及对应博客稿比对，使用 Chromium 验证桌面与手机、写作日期顺序、SEO 与完整公开访问。
- `node deploy/verify-article-images.mjs`：匿名读取正式域名，比较 960px 同尺寸 PNG 与 WebP，检查真实像素、CDN HIT/304，使用全新浏览器上下文读取三篇并重复导航。默认不修改生产数据。
- `node deploy/verify-public-image-cache.mjs`：独立权限撤销验收。需要已有生产 SSH/数据库/OSS 凭据与 Vercel CLI 登录，创建唯一合成公开稿，串行执行受资源限制的 CLI，验证转付费/下架阻止旧 URL 后清理合成数据。凭据不进入报告。

## 已留存证据

- `svg-regression-before.log`：真实 Caddy 边界先复现 SVG 502。
- `svg-regression-after.log`、`svg-typecheck.log`：修复后聚焦 2/2 与类型检查通过。
- `svg-e2e-full.log`、`local-caddy/playwright-report/index.html`：完整 90/90 通过。
- `svg-candidate.json`：五张实际 SVG 的 31/31 断言通过，原始 SHA256/逐字节一致、Vercel HIT、实际弱 ETag 条件请求 304 零响应体。
- `svg-candidate-first.json`：首次验收脚本误将 Vercel gzip 的合法弱 ETag 视为不合格；修正断言为 identity 值一致，并继续要求真实条件请求零字节。
- `source-media-svg-failure.json`：主图片链路验收发现的 SVG 502，保留故障记录。
- `public-image-cache.json`：真实 OSS/候选部署的缓存与权限撤销，合成数据已清理。
- `source-proof.json`、`content-change.json`：本轮重新读取 Notion 的原文比对和日期更改记录。
- `network-before.json`：原 Workflow 重复阅读仍传输图片字节的基线。

## 发布追踪

PR #11：https://github.com/nanzhi84/yoryon/pull/11（格式与公开图片链路）

PR #12：https://github.com/nanzhi84/yoryon/pull/12（真实 Caddy SVG 压缩边界）

Web main：`7edde6f601a41d3e6626cf1e70a0af851d94f154`。

API 镜像：`yoryon-api:c52e0a12b5ee69a0763ea2327faf7448c4a373cd`。SVG 修复只更新 Web。此次没有停止或重启云实例，保留旧 API 镜像和旧 Vercel 部署供回滚。

正式域名验收结果与压缩统计由 `article-acceptance.json`、`publication-acceptance-final.json`、`release-receipt.json` 记录，最终状态以这些工件为准。

## 最终结果：PASS

正式部署 `dpl_4xqDzA6XELnNbZw7ka5doG2LL8sF` 已 READY，`yoryon.com`/`www.yoryon.com` 已绑定，来源精确匹配上面的 main。main 的 Vercel 检查通过。

完整 E2E 90/90；实际 SVG 候选检查 31/31；正式文章源码、原图 SHA、公开免费与桌面/手机验收 82/82；正式格式、图片 CDN 与重复阅读网络检查 115/115。三个最终截图已人工检查，加粗正确、行内代码无装饰反引号、SVG 文本与样式完整。

11 张 PNG 的同尺寸（960px）比较：原响应合计 1,062,521 字节，质量 72 的 WebP 合计 221,128 字节，减少 79.2%。SVG 五张继续使用原始矢量字节。Notion 引用确认为 Workflow 5 PNG、Harness 6 PNG、Jev 5 SVG，本地源文件 magic bytes 与类型一致，没有把 PNG 包装成伪矢量。

六个浏览器上下文（每篇桌面/手机）重复导航都没有重新传输图片响应体；Workflow 五张图重复访问总传输仅 264/265 字节，Harness 六张 342/316 字节，Jev 五张 608/613 字节。为满足公开转付费和下架后的权限撤销，浏览器仍进行轻量条件校验，不宣称完全零网络或零等待。

两条本任务分支的提交已包含在 main，远端按预期 SHA lease 删除，本地安全 `-d`，当前仅 main；初始未提交文件保留。最终服务器 API 健康，可用内存 375 MiB，实例 uptime 连续；本次没有云实例电源操作。
