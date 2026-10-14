# 独立内容验收（只读）

时间2026-10-14，隔离预览 http://localhost:3016，API4115、数据库yoryon_page_redesign_20261013。样例为用户交付内容，保留4篇文章与合集；未写业务数据、生产或邮件，也未新增测试程序。

PASS：
- 首页与合集 /c/editorial-preview 的实际SSR HTML均包含4篇文章链接，合集标题“长文排版预览”。4篇详情有各自完整标题与正文。
- 原文转载 /p/editorial-reference 实际SSR含11个代码块，后段调查、结语、参考文献、转载声明与原文来源到达渲染结果；未执行文中代码。原版本地HTML含中英文标题，字节111847。
- 上下篇链接实际渲染为essay→notes→reference→visual，头尾边界无错误跨篇。
- 图文两张图片真实请求返回image/svg+xml。comparison.svg为856字节、SHA256 645a91bf2992972b1ca0ce314e06dcfc49c70e19a5ffc0392069e189f17f5c31；landscape.svg为403字节、SHA256 f3b10a580f9da2e2fa25eae936f49f4a8bac04cb21a1b16cff103ab5fc7009b5。与交付源文件逐字节一致。

UNVERIFIED（独立agent）：本轮内置Browser获取返回Browser is not available，cua.getState()返回browsers=[]；因此独立agent没有现场确认375px代码横滚、长链接横向溢出、图片放大或点击上下篇。SSR内容及媒体字节PASS不能代替这些浏览器路径。主agent另行浏览器证据须明确标为主agent执行，不能声称是独立agent现场测试。

本人没有成功建立浏览器tab，未产生自身SID，未执行统计清理。样例内容保留。

复现只读内容与媒体核对：启动环境见artifacts/editorial-layout-20261014/README.md，在隔离预览运行 `curl -s http://localhost:3016/c/editorial-preview` 和4篇详情，检查标题、正文后段、上下篇；图片URL见read-only-receipts.json，使用 `curl -s <图片完整URL> | shasum -a 256` 与 `shasum -a 256 artifacts/editorial-samples-20261014/posts/editorial-visual/media/*.svg` 对照。实际现场命令为Python urllib.request取SSR及图片、html.parser抽取正文、hashlib.sha256核对字节；结果保存read-only-receipts.json、content-contract-receipts.json、reference-rendered-text.txt以及HTML/图片字节文件，不新增可执行程序。

## 最终版本与主agent浏览器补证复核

独立刷新最终reference SSR：454495字节、11个pre，原文2026年10月12日、参考文献仍在；Shoufa Chen、Peize Sun、Chongjian Ge、Shilong Zhang、Ting-Che Lin各自对应人物主页/GitHub链接保留。最终具体链接见reference-final-receipt.json，最终HTML已覆盖p-editorial-reference.html；早先read-only-receipts.json为首次验收快照。

独立agent已读取main-agent-browser-evidence.md，并逐张查看主agent保存的本地JPEG截图：notes-mobile-code.jpg可见等宽代码独立容器和横滚条；visual-mobile-lightbox.jpg可见背景变暗、图片放大；visual-mobile-article.jpg可见正文图像和斜体图注；reference-article.jpg可见原作者来源、原文页面链接和原文日期。截图与主agent记录的375px代码横滚（clientWidth312/scrollWidth1352/scrollLeft360）、页面scrollWidth360，以及图片打开/Escape关闭回执相符。

判定：这些路径为“主agent现场PASS，独立agent工件复核PASS”；独立agent自身未现场操作浏览器，先前UNVERIFIED限制保留。静态截图无法独立证明滚动或Escape事件发生，但实际记录与截图未发现矛盾。图片字节与SSR内容仍由独立agent直接验证。原版HTML和用户交付样例全部保留。
