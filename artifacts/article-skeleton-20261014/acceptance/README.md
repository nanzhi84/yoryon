# 文章骨架屏独立验收

版本：工作区未提交变更，生产构建目录 `/var/folders/d_/8w6ff22d7gn6r0vr84g21d5r0000gn/T/yoryon-skeleton-build-y9_3kdbl`。
环境：Web localhost:3117，API 127.0.0.1:4117，隔离数据库 yoryon_reading_preview_20261014；沿用25篇公开稿。只操作本agent IAB新建标签，未操作主标签或线上数据。

## 结果

- PASS：真实首页自动预取带 next-router-prefetch:1。以捕获的请求头重放，5099byte RSC包含文章加载中骨架，不包含正文孙宇晨；prefetch.rsc及headers保存实际负载。浏览器 Network.getResponseBody返回资源不存在，未据此声称已读该响应体；用相同请求头curl重放补足协议证据。
- PASS：预取完成后为本标签增加1500ms延迟，真实点击先自由后财富。168ms工具回执时URL已是 /p/freedom-before-wealth，DOM只有SiteHeader、返回和文章加载中，无首页feed、无正在打开。navigation-early.json。该时间含工具开销，只证明先切独立页再等正文，不是绘制性能或任意网络绝对零延迟。
- PASS：随后正文加载完成，骨架消失；真实返回按钮回到首页。article-complete.json。
- PASS：公开转付费后新点击不复用旧全文。真实CLI在隔离库创建独立slug skeleton-acceptance-revocation，基于现有真实文章正文，先完整访问并返回首页；再CLI发布paid20%，从旧首页点击同一链接。先出现骨架，后只显示当前预览/付费标识/兑换入口，全文末段不存在。revocation-public-dom.txt、revocation-paid-dom.txt。
- PASS：不存在slug真实浏览器呈现404和回到首页入口，not-found-dom.txt。
- PASS：实际骨架截图 skeleton.png（仅为捕获状态在自己的标签临时3000ms延迟，随后清除）。
- UNVERIFIED：API不可用/超时后页内错误及重试真实故障路径；未停止共享preview API，也未构建额外代理环境。源码存在页内alert和router.refresh/reset重试，但不代替端到端证明。
- UNVERIFIED：冷导航在尚未完成shell预取的网络极端情形；此次可见路径均已完成自动壳预取。

## 缓存范围源码复核

static staleTime恢复300，dynamic仍0。新增自动partial预取仅AnalyticsLink prefetchShell分支。SiteHeader、合集导航、引用卡、兑换/登录、通知、问题卡等现有Link仍prefetch=false；订阅、问题详情、通知和合集详情显式force-dynamic。未发现本改动把这些权限页面改为完整自动预取。静态目录/标签页依旧使用其原有publicFetch DataCache和revalidation；此为源码范围核对，未对全部导航执行端到端回归。

## 可重做步骤和命令

1. 在环境对应生产build启动Web与API后，独立IAB打开首页，启用CDP Network；记录自动prefetch headers。
2. CDP Network.emulateNetworkConditions latency1500，点击真实标题，立即记录URL/DOM，再读取完成DOM并点击返回。
3. `curl -sS 'http://localhost:3117/p/freedom-before-wealth?_rsc=1p-R_iEY6bj0jY31' -H 'rsc: 1' -H 'next-router-prefetch: 1' -H 'next-router-state-tree: %5B%22%22%2C%7B%22children%22%3A%5B%22__PAGE__%22%2C%7B%7D%2Cnull%2Cnull%5D%7D%2Cnull%2Cnull%2Ctrue%5D'`
4. `pnpm exec tsx --env-file=<preview.env> apps/cli/src/index.ts publish <temporaryRoot>/skeleton-acceptance`：独立复制稿先public/full再paid/percent20，中间实际浏览器打开并返回。配置路径见父目录preview environment，秘密未进入工件。
5. `docker exec deploy-postgres-1 psql -U postgres -d yoryon_reading_preview_20261014 -Atc "select current_database(),slug,type,visibility from contents where slug='skeleton-acceptance-revocation'"` 确认cleanup-scope.txt仅本次临时slug；`pnpm exec tsx --env-file=<preview.env> apps/cli/src/index.ts content delete skeleton-acceptance-revocation`，真实回执cleanup.log。

已删除自己的临时稿源目录及独立内容；原25篇保留，浏览器自己标签已关闭，人工延迟清除，主服务继续运行。无永久测试脚本或测试钩子。

## 后续 Shimmer 与故障补验

- Shimmer PASS：当前生产build实际::after computed animationName reader-shimmer、duration1.6s、横移transform与白65%渐变；prefers-reduced-motion reduce模拟后animationName none/display none。shimmer.json。模拟已清除。
- 初版错误恢复 FAIL：独立3127实例上游设不可达4198，错误提示/重试按钮出现；仅重启3127恢复4117，原页点重试后仍旧错误，error-dom.txt/retry-dom.txt。主agent已收到并修复中，须以最终复验为准。
- 独立3127启动命令：在当前build/apps/web目录执行 `API_INTERNAL_URL=http://127.0.0.1:4198 NODE_ENV=production node --env-file=<preview.env> node_modules/next/dist/bin/next start --hostname 127.0.0.1 -p 3127`；恢复时4198改4117。4199有已有ssh监听因此未占用，4198经lsof确认无监听。
- 3127非允许origin导致analytics POST被CSRF拒绝，预期隔离配置现象，未改安全设置；文章只读内容/API路径不受影响。

## 最终修复复验

- PASS：最终error.tsx显式重试采用整页reload。独立3127上游4198不可达，实际先观察到骨架，随后错误/重试；仅重启自己的3127将上游恢复4117，原错误页点击重试，实际再经历骨架并显示完整正文/末段，错误提示消失。final-error-dom.txt、final-retry-dom.txt。前述UNVERIFIED错误恢复与初版FAIL均由此最终结果取代；故障仅验证ECONNREFUSED，慢响应超时未单独模拟。
- 最终Shimmer截图：shimmer-skeleton.png。仅自己标签临时5000ms限速，截图后撤销并关闭标签，未改变生产代码延迟。
- 自己启动的3127最终session15518已SIGINT停止退出0，所有自己新建标签已关闭；主3117/API4117保持运行。无验收专属内容残留。
