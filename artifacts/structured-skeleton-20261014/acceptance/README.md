# 结构骨架独立验收

环境：localhost:3117 / API127.0.0.1:4117 / 隔离数据库 yoryon_reading_preview_20261014；版本与构建目录见父目录 environment.json。仅自有IAB标签，现已关闭，网络/移动模拟已清除。未操作生产。

## 结果

- PASS：真实点击先自由后财富，进入独立 /p/freedom-before-wealth；骨架保留真实标题日期，12块对应匿名API的段落、小标题顺序与长度。首个工具采样当即可见该结构。首次单独保存的 freedom-loading.json 已晚于正文完成（blocks为空），不以该文件单独证明骨架；mobile-freedom.json/png提供确实处于骨架状态的可复核证据。
- PASS：真实点击 Workflow 文章，workflow-loading.json/png保存摘要、段落、标题、列表、媒体占位共12块；与feed实际readerLayout一致，区别于Freedom。媒体通用360px占位，不声称匹配真实图片纵横比。
- PASS：Workflow返回后点击Freedom，slug/标题与块型均属于Freedom，无旧标题/媒体串入。仅顺序导航，不声称已覆盖所有高频并发导航竞态。
- PASS：390px移动宽度时骨架内容宽342px，document scrollWidth=390，无横溢；长段自动增行，小标题自动两行，mobile-freedom.json/png。
- PASS：结构骨架computed ::after animationName=reader-shimmer；正常正文完成即替换骨架，未观察固定等待。此次验证动画存在，扫光位移和减弱动画偏好沿用旧验收，本轮未重复计时。
- PASS：隔离CLI以真实Freedom文章创建单次paid marker稿，第一段之后全部藏在more标记后。匿名paid-feed仅给1个paragraph lengths[17]，没有隐藏后续标题、列表或完整文章形状。paid-feed.json、publish-paid.log。自建slug structure-acceptance-preview已通过CLI删除，cleanup.log；仅此临时稿源目录已删除。
- PASS：首屏8篇真实文章形状只含kind/lengths/level，最大12块、最大JSON652bytes；api-summary.json。协议schema另限制每块12长度、每值最大4000。已观察真实长文截断12块；未造极限输入压力测试。
- PASS：以实际协议重放partial prefetch，4075bytes RSC含加载组件，不含正文孙宇晨；prefetch.rsc。此是协议响应验证，并非浏览器网络body截取。
- UNVERIFIED：直接reload的fallback可见状态，本地正文完成过快未捕获；源码匹配不到slug时回退三段通用骨架，不作为浏览器通过。
- 已观察限制：Workflow在当前视口外，点击后第一采样仍在首页；3秒人为网络延迟时约3.3秒才取到骨架。未完成壳预取的冷导航仍受网络影响，不能声称所有点击绝对无延迟。Freedom已预取壳路径立即切换成功。

## 可重复运行

1. 使用父目录environment对应生产build与隔离API；IAB新标签打开首页。
2. CDP Network.emulateNetworkConditions latency=3000, offline=false, downloadThroughput=-1, uploadThroughput=-1，仅限自身标签；真实点击文章标题，以[data-skeleton-block] attached为捕获时机。
3. 读取DOM标题/URL、块kind与bar几何，截图；正文完成后真实返回并点击另一篇文章。CDP Emulation.setDeviceMetricsOverride width390 height844 mobile=true deviceScaleFactor1观察响应式，再clearDeviceMetricsOverride。
4. `curl -sS http://127.0.0.1:4117/api/feed`；实际响应保存feed.json。
5. 临时稿基于现有Freedom文本复制，仅改slug/title/paid marker并在第一段后插入`<!-- more -->`。`pnpm exec tsx --env-file=<preview.env> apps/cli/src/index.ts publish <temporaryRoot>/structure-acceptance`；`curl -sS http://127.0.0.1:4117/api/paid-feed`。
6. `curl -sS 'http://localhost:3117/p/freedom-before-wealth?_rsc=acceptance' -H 'rsc: 1' -H 'next-router-prefetch: 1' -H 'next-router-state-tree: %5B%22%22%2C%7B%22children%22%3A%5B%22__PAGE__%22%2C%7B%7D%2Cnull%2Cnull%5D%7D%2Cnull%2Cnull%2Ctrue%5D'`。
7. `pnpm exec tsx --env-file=<preview.env> apps/cli/src/index.ts content delete structure-acceptance-preview`，只清理自己数据。恢复网络latency0，关闭自建标签。

无固定测试程序、无生产修改。最终仅subscription LoadMore basePath修正由主agent随后切换构建，结构验收覆盖上述实现。
