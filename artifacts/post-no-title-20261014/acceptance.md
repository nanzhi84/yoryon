# 帖子无标题独立验收

2026-10-14，publication_acceptance 子 agent。当前实现SHA见source-sha256.json。

PASS：独立审查最终两组件，post首页标题块移除，改用日期链接，aria-label“查看 YYYY.MM.DD 的帖子”，仍为TrackClickLink；文章标题保持；post置顶/付费badge均有独立条件保留；详情post不渲染h1、日期左对齐，文章h1与居中保持；tags/collections仅非空渲染，post左对齐。未发现授权或缓存接口变更。此项为源码审查，不宣称覆盖实际付费/置顶浏览器结果。

隔离环境：复制当前已追踪源码到workspace-path.txt列明的独立目录，并仅symlink现有node_modules。preview.env确认DATABASE_URL为localhost:54320/yoryon_page_redesign_20261013、API为4115；实际匿名feed读取成功。未写生产或隔离业务数据。

PASS：实际项目构建 `set -a; source /tmp/yoryon-page-redesign-m0NxxV/preview.env; set +a; export NODE_ENV=production; pnpm --config.verify-deps-before-run=false build`，退出0，build.log留存。该pnpm配置跳过复制工作区依赖状态探测，避免其触发安装与修改共享node_modules。最初沿用preview.env的development会在404 prerender触发Html错误，改用适当production构建环境后通过；这不是业务验收证据。

PASS：独立构建用 `pnpm --config.verify-deps-before-run=false --filter @yoryon/web exec next start -p 4179` 启动。GET http://127.0.0.1:4179/ 首页含3个隔离现有post，均没有其标题h2，日期具正确href和aria-label；GET /p/demo-audio 无h1；GET /p/editorial-essay 仍有原文标题h1和正文段落。响应及提取文本见local-*.html、local-*-text.txt与local-http-results.json。实际隔离数据缺少付费/置顶与长帖场景，未新增fixture。

UNVERIFIED：浏览器真实首页日期点击→详情→返回、长帖展开、窄宽与主题视觉。仅一次尝试内置Browser，返回“Browser is not available: iab”，未反复重试或使用用户Chrome会话。HTTP结构不能代替视觉或交互验收。付费与置顶badge目前仅源码审查，因本地已有数据无该场景。

生产部署后验收待补充。

## 生产最终验收

主 agent 提供部署 dpl_4FocscT3FdtzYrEGqYQXi8cHsaZy、源码 a0afa2c。独立普通匿名 GET 实际域名 https://yoryon.com：PASS。首页 SSR 12 个本次帖子都无标题h2与“未命名内容”占位，仅日期入口；每个日期链接有正确 slug href 和描述性 aria-label。其余 h2 全为文章原标题。16 个帖子的实际匿名详情全部无 h1/占位、日期正确、完整正文连续匹配发布稿（包含长帖）；《先自由后财富》仍有h1“先自由后财富”。生产变更前后HTML已保留，确认域名页面确实反映本次改动。

PASS：生产feed两页仍含后4个post，分页JSON回执已保存；这4个详情独立GET亦全部通过。第二页实际客户端追加后的标题显示、日期点击与交互仍为UNVERIFIED，不能由JSON或共享源码代替真实浏览器结论。长帖首页“展开”入口仍在，详情完整全文已验证；真实展开、返回、窄宽和主题仍未验证。置顶/付费badge实际场景仍仅源码核对，未制造生产数据。

证据：production-http-results.json、production-home.html、production-article.html、production-note-*.html、production-feed-1.json、production-feed-2.json。重跑用curl -fsSL上述真实URL与/api/feed，其后按version/nextCursor请求/api/pages/<version>/feed/<encodedCursor>。全文核对源为artifacts/dated-posts-20261014/posts/。无新增生产写入或邮件。
