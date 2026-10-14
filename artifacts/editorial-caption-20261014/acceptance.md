# Caption 独立验收

2026-10-14。隔离3016/4115与yoryon_page_redesign_20261013；无业务/生产/邮件写入，用户样例保留，无新测试程序。

PASS（独立直接核查）：reference实际SSR恰有5个editorial-caption：代码1、代码2、列表1、卡片组、图1；visual恰有2个。essay、notes、hello-world、demo-ep1均0，现有普通段落无误判。所有caption使用p，没有脱离figure的figcaption。6篇搜索装饰节点从t0连续，reference311、visual42，顺序未改变。MarkdownSurface调用链为search→summary→caption；Caption展示组件无数据库/权限读取，公开与PrivateReader的正文仍复用MarkdownSurface。

源码风险待处理：imageCaption目前仅检验首em且文本图N开头，未保证整段唯一em；图片后混合斜体图N和普通正文可能误判，已反馈主agent。现有样例无此问题，不将样例PASS扩大为边界证明。

UNVERIFIED：独立Browser discovery为browsers=[]，无法独立取得computed-style、视觉或搜索点击。字体最终字形来源UNKNOWN，字体栈不等于实际字体。待主agent现场工件复核；不声称整站、轮播或原图结构复刻。

实际只读操作：Python urllib.request获取6篇/p/详情，html.parser核对caption标签、文本和data-search-node顺序；每页HTML与ssr-receipts.json已保存。复现需先按上一轮README启动隔离环境，再curl上述路径核对实际HTML。源码读取design.md、rehype-caption.ts、caption.tsx、MarkdownSurface、globals.css。未能创建浏览器tab，无自身SID。

## 最终源码与主agent工件复核

独立重读最终rehype-caption.ts：meaningful.length===1约束已补，图片后混合斜体/正文段落不会走imageCaption分支；此前风险已解决，未新增测试程序。

独立解析typography-desktop.json与typography-mobile.json，对original/local整体字典比较均完全相等；8种角色的字号、字族、字重、行高、斜体字段无diff。独立读取caption-platform-fonts.json：父caption字形统计不同，但正文共同字体PingFangSC-Regular和.SF NS；读取caption-label-platform-fonts.json，原标签与本地标签字体、PostScriptName、glyphCount完全相等（PingFangSC-Semibold与系统.SF NS）。caption-dark-colors.json原/本地正文和标签颜色相等，reference-refresh.json原CSS SHA256未变。上述为主agent同浏览器现场采样、独立agent对保存JSON复核，未伪称独立浏览器采样。

独立查看caption-desktop.jpg、mobile-reading-context.jpg、caption-dark.jpg、caption-detail.jpg、search-caption-highlight.jpg。桌面/深色图代码下实际图注为小字号无衬线，标签比说明更重；detail确为代码1图注；搜索图显示“正文命中1/1”及目标图注句子黄色高亮，与主agent精确Range回执相符。移动图为标题/要点上下文，未直接截到caption；移动caption具体值由同视口JSON证明。

结论：独立SSR/源码直接PASS；主agent现场排印对照和搜索路径PASS，独立工件复核PASS。当前平台选定caption与标签字体已有实证，不再将该选定样本标UNKNOWN；其他字形、全篇和其他系统的字体回退仍UNKNOWN/UNVERIFIED。私有正文仅确认组件共用，未登录付费账户现场验收。导航、阅读列宽、原图结构、流程/轮播仍有差异，不声称全站或原页像素复刻。主agent报告最终typecheck/build通过；自身会话清理以cleanup/cleanup-followup回执为准，未触碰用户交付内容或正在浏览的页面。
