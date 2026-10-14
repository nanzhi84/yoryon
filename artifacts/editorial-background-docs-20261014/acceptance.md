# 背景与作者文档独立验收

2026-10-14。仅只读源码与文档核对；隔离本地预览，未写业务/生产/邮件、未增测试程序，用户样例保留。独立内置Browser在前述轮次持续不可用，现场背景由主agent补证后独立复核。

PASS（独立直接核查）：
- docs/markdown-rendering.md 与 rehype-editorial-summary.ts 的h2-h6、顶层标题恰为本文要点、只越过空白到非空ol一致；普通列表及空标题不包装。
- 图注粗体标签正则、独立顶层段落、图片后唯一em图N冒号条件及p/figcaption说明与rehype-caption/Caption吻合。
- MarkdownSurface真实remark链为CJK-friendly/directive/media；未启用GFM、rehype-raw、数学或Mermaid；ReactMarkdown不执行原HTML。audio/video/work leaf directive与UUID渲染映射符合文档，发布媒体相对路径由core改写。
- MarkdownBody服务端按bundledLanguages加载Shiki，未知语言保留plain；客户端共用MarkdownSurface但不传Shiki代码渲染器。search文本装饰先于summary与caption识别，与文档一致。
- 字体栈、正文17/1.85及640px16、Caption13/1.55/400标签600、strong650、h1/h2/h3、信息流15/24、代码桌面13/移动12与globals.css相符。
- root背景/canvas均#ffffff；dark背景/canvas均#151514；body消费canvas，蓝灰品牌控件变量保持。要点浅#f3f3f2深#1f1e1c与文档一致。
- README文档链接与architecture8.3相对链接解析至实际文件；8.3当前660px衬线阅读列与导航分工吻合源码。

实际只读命令：cat docs/markdown-rendering.md、MarkdownSurface、MarkdownBody、Caption/rehype-caption/rehype-editorial-summary；rg检查README/architecture链接、CSS、core媒体发布规则。没有用HTTP成功或构建成功代替浏览器验收。背景实际像素与主题切换当前独立UNVERIFIED，待主agent工件。

## 最终主agent现场补证复核

独立读取background-computed.json、main-agent-browser-evidence.md，并查看background-light.jpg/background-dark.jpg。浅色body计算背景rgb(255,255,255)、canvas#ffffff；深色rgb(21,21,20)、canvas#151514；要点卡片分别rgb(243,243,242)/rgb(31,30,28)，与源码及文档一致。截图可见浅白、深中性背景及仍可辨识的文字、编号和导航控件，未发现与回执矛盾。判定“主agent现场PASS，独立agent工件复核PASS”，不是独立agent浏览器执行。主agent报告静态/build通过、恢复浅色、关闭自己的tab并清自身SID。

文档新增preview边界与architecture6.2语义一致：公开缺省full、付费缺省none；marker缺少<!-- more -->拒绝发布；Markdown AST裁剪，注释是发布分界而非启用HTML执行。标题“6.2 预览截断（Markdown AST 层）”按Markdown/GitHub自动标题ID规范得到62-预览截断markdown-ast-层，与文档链接相符。未现场访问远端GitHub渲染页验证anchor，此项为本地标题规范核对。

无新FAIL；未扩展生产、媒体、付费交互验收，交付内容与用户已有浏览页面保留。
