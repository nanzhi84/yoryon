# 系列标签独立验收

2026-10-30，network-article-sync/yoryon；本地构建预览 127.0.0.1:3103。数据前提：当前已发布系列仅《Vibe Coder速成科普（1）：计算机网络》一篇。未创建业务测试数据。

PASS：独立比较 HEAD 与工作区 content/site.json，65篇ID不变，仅目标文章 tags 新增显示名 Vibe Coder速成科普、slug vibe-coder-crash-course；其余正文/元信息/媒体列表完全一致，assets不变，根字段仅exportedAt变化。见 independent-diff.json。
PASS：独立解析构建HTML，/tags/ 显示命名标签并链接 /tags/vibe-coder-crash-course/；系列页链接到 /p/vibe-coder-computer-networks/，标题准确。见 independent-links.json。
PASS（独立证据复核）：主agent隔离headless执行目录→系列→文章点击路径，browser-result.json记录正确系列标题、唯一文章链接、正确文章URL、五图注及结尾存在。本子agent独立读取 tag-page.png，系列标题、文章标题、摘要与2026.10.29可见，布局正常，无阻断。

执行主体说明：本子agent的CUA inventory browsers=[]，未操作用户桌面；浏览器执行由主agent完成，子agent独立核对数据/HTML/截图，不冒称独立执行了浏览器点击。
UNVERIFIED：公网发布后状态、其他浏览器及手机（本次标签改动未改布局），媒体字节无需重验，快照assets及正文媒体引用逐对象不变。
复现：pnpm build；pnpm preview --port 3103；打开 /tags/，点击 Vibe Coder速成科普，再点击唯一文章，核对标题与正文。临时HTMLParser/JSON比较通过命令现场执行，未新增固定测试程序。
