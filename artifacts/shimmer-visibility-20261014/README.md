# 扫光可见性修正

此前底色rgb(237,245,250)与65%白高光对比弱，1.6s ease-in-out从条外起步。此次只修改CSS：底色混入10%foreground、高光收窄到50%宽并提升至90%白（dark20%），1.2s linear并用-0.4s起始相位，让短暂加载的第一帧已有亮带。正文不设最短等待。

PASS：pnpm typecheck、隔离build的pnpm build。主agent真实IAB路径：首页→文章骨架，MutationObserver只读记录250ms两帧，transform从0移动至99.7952px，两次元素均仍挂载，见motion.json。after.png为真实新骨架首帧，before.png为旧效果。reduced-motion.json实测动画none且高光display:none。

复现：环境environment.json，真实公开文章freedom-before-wealth。新开IAB首页待自动预取完成；CDP Network.enable，临时latency3000仅便于取证；点击文章后首帧与250ms后读取getComputedStyle(element,"::after").transform。另一路同样读取prefers-reduced-motion reduce时的animationName/display。测试完撤销限速及媒体模拟并关闭测试标签。主用户预览已刷新新版，没有人工限速。无永久测试脚本或生产变更。

独立审核见acceptance/README.md。子agent本轮浏览器provider不可用，明确区分主agent浏览器执行与子agent证据审核。
