# 页面同宽与简介要点交付

2026-10-14，commit 8b8cdc247358ef4b1a1893d42d109c1f0589854d 已push origin/main。
生产 dpl_FRww72a5kTfwuoVwhtngiifGme7X READY，yoryon.com 已分配，production-provenance.json 核对源SHA与别名。

PASS：pnpm typecheck（typecheck.log）；隔离 pnpm build（build.log）。
PASS：独立11页面SSR、3类可保留长文要点（acceptance.md、summary-final-receipts.json）；桌面导航正文660px同左右边，375px视口各312px无横向溢出（description-desktop.jpg/mobile.jpg）。登录页移动同宽。
PASS：生产匿名 GET+DNT1核对 Jev 原description转本文要点、标题metadata不重复、首页/login统一外壳（production-acceptance.md）。

真实浏览器命令路径：localhost:3016 → editorial-essay（作者列表优先，仅一卡）→首页→demo-ep1（空简介无卡）→editorial-summary（句子卡片）→375px viewport→login。DOM snapshot、getBoundingClientRect、scrollWidth核查后截图。生产浏览器标签打开后控制接口两次超时，生产截图未取得；本地截图不是生产截图。中断后dev重启为脱离会话进程72191/72192。

复现前提：API127.0.0.1:4115；DB yoryon_page_redesign_20261013；FS /tmp/yoryon-page-redesign-m0NxxV/storage；凭据仅私有env，不包含于工件。启动隔离前端副本的next dev -p3016 -H127.0.0.1，ALLOWED_ORIGINS与SITE_URL均http://localhost:3016。浏览入口 http://127.0.0.1:3016/p/editorial-summary 。
交付示例：editorial-summary、editorial-paragraph、editorial-bullets，源posts目录。重生成命令：node --env-file=/tmp/yoryon-page-redesign-m0NxxV/preview.env --import tsx apps/cli/src/index.ts publish artifacts/editorial-width-summary-20261014/posts；仅隔离环境执行，按slug更新，publish.log。样例按用户要求保留，不上传生产。
发布命令：git commit、git push origin main（commit.log/push.log）；Vercel Git集成生产构建；vercel inspect 对应部署 --wait --timeout60s --format json。
短时运行错误观测：vercel logs dpl_FRww72a5kTfwuoVwhtngiifGme7X --level error --since10m --limit20 --json（实际参数有空格，回执runtime-errors-command.log），不代表长期运行保证。
回滚点：上一生产 dpl_AJqao81Gp2pNCnueNsF7rmtcKmWb，commit b2470bc0320b9a88f809467cd43b84e36fad65a2；前轮production-provenance.json。
UNVERIFIED：独立Browser、生产截图、付费账户现场权限路径、跨OS字体回退。未改API/数据库协议/授权，不写生产内容或账号邮件。源码docs无未提交修改，工件本地保留不提交。
