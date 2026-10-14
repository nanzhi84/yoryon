# 独立验收

环境：2026-10-14，隔离3016/4115、yoryon_page_redesign_20261013。未写业务数据或生产、未发邮件；样例保留。本轮独立Browser discovery仍为browsers=[]，无法独立现场点击/视觉检查。

PASS（独立SSR与源码）：4篇editorial样例分别1个semantic section要点卡片，3条有序列表项，每条1个strong；hello-world与demo-ep1不生成空卡片。reference保留2个普通ol，notes/visual各保留1个，普通列表未误包装。6篇标题均进入editorial-title头部。data-search-node从t0连续且顺序正确：reference311、essay34、notes54、visual42、hello-world3、demo-ep1为1。实际源码rehypeSearchText先于rehypeEditorialSummary，后者仅包装顶层明确标题“本文要点”及后续ol，不重排/删除已装饰文本。CSS条目首个strong display:block、圆形计数与深色规则存在。以上只证明渲染结构和搜索标记不变，不代替视觉或搜索点击业务证明。

UNVERIFIED（独立现场）：桌面/375px标题居中与长短换行、卡片编号粗体独立行、深色、横溢、search→点击内容定位。原因：内置Browser不可用，不擅自复用用户Chrome。若主agent补现场工件，另行明确来源复核。

实际命令：Python urllib.request请求 http://localhost:3016/p/{editorial-reference,editorial-essay,editorial-notes,editorial-visual,hello-world,demo-ep1}，html.parser识别section/li/strong/ol并检查data-search-node顺序；保存每页HTML和ssr-receipts.json。源码现场读取ContentView、MarkdownSurface、rehype-editorial-summary.ts、search-text.ts、globals.css。复现前提按上一轮README启动隔离API和3016，再用curl取上述页并核对结构。不新增测试程序。未成功创建tab，无自身统计SID。

## 主agent浏览器补证的独立复核

独立读取main-agent-browser-evidence.md并逐张查看reference-desktop.jpg、reference-mobile-light.jpg、reference-mobile-dark.jpg、search-summary-highlight.jpg。桌面图可见居中长标题、日期说明、浅灰3点卡片，编号圆形且粗体标题独立行；375px浅深色图长标题正常折行、卡片保持列内，深色编号与正文可读。搜索图清楚显示“正文命中1/1”以及卡片第一点“从读者路径倒推”精确黄色高亮，与主agent记录的CSS.highlights size1、Range文本匹配一致。

判定：上述范围“主agent现场PASS，独立agent工件复核PASS”。独立agent不能仅据静态图证明点击全过程、伪元素计算尺寸或无alert，但截图与现场回执未发现矛盾。独立SSR顺序和无空卡片检查仍为直接证据。短标题实际响应布局尚无本轮独立视觉证据，故该项保留UNVERIFIED。

主agent首次搜索来源非法已通过仅调整隔离3016进程的ALLOWED_ORIGINS/SITE_URL解决；未改CSRF实现。主agent报告pnpm typecheck/build通过。此处明确记录执行来源，未把构建或HTTP成功等同业务验收。
