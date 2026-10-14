# Editorial release 20261014

版本：b2470bc0320b9a88f809467cd43b84e36fad65a2，origin/main 同步。
生产：https://yoryon.com，部署 dpl_AJqao81Gp2pNCnueNsF7rmtcKmWb，READY，域名已分配。

本轮删除首页底部订阅支持块；同时提交当前阅读排版、背景、caption、可选要点块和 Markdown 文档。仅前端与文档，无数据库迁移或 API 部署。

验证与复现：
- 仓库执行 pnpm typecheck；结果 typecheck.log。
- 隔离 API/DB/存储环境下执行 pnpm build；前提见 design.md，结果 build.log。隔离样例保留供用户预览，没有发布至生产。
- git push origin main；回执 push.log；commit.txt、origin-main-sha.txt。
- vercel inspect dpl_AJqao81Gp2pNCnueNsF7rmtcKmWb --wait --timeout 90s --format json；deployment-ready.json、remote-build.log。
- 独立验收结果 local-acceptance.md、production-acceptance.md、production-ssr-receipts.json。
- 主 agent 真实浏览器证据 main-production-browser-evidence.md 与 production-home.jpg、production-article.jpg。
- vercel logs dpl_AJqao81Gp2pNCnueNsF7rmtcKmWb --level error --since 10m --limit 20 --json；短时观察结果 runtime-errors.json，不代表长期运行保证。

回滚点：上一生产部署 dpl_HZSKUJSBifHGFtq5tjPSHfxTmKDF，ce35856b3cb1f794439dea7e986c6f55e8462b33，previous-production.json 与 previous-provenance.json。
未覆盖：生产支付/认证写入、跨系统字体回退、长期监测；生产合集/上下篇因现有数据不含合集未覆盖。
验收工件仅本地保留，不提交；当前源码和文档无未提交改动。
