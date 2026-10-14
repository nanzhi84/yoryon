# 发布前独立验收

2026-10-14，隔离http://localhost:3016。只读源码/文档/实际SSR；未写生产、邮件、账户、业务数据；交付样例保留。未新增固定测试程序。

PASS：首页实际SSR无订阅支持section、原文案“更深入的作品，更直接的交流”、了解订阅链接；导航/subscription保留，首页内容仍存在。reference继续阅读、1个要点卡片、5个Caption保留；demo-ep1继续阅读且无空要点卡片。回执local-ssr-receipts.json与3页HTML。

PASS：最终rehype只包顶层h2-h6恰为本文要点且邻非空ol；caption严格粗体标签或图片后唯一em图N冒号，搜索先装饰并保留节点/文本。没有slug特殊分支、权限读取、执行原始HTML或新增GFM。代码高亮沿用服务器Shiki、客户端普通代码。docs准确说明媒体、预览marker/权限裁剪及当前字体与已知语法限制，不夸大全站像素复刻。各轮主agent浏览器已补证且独立工件复核见前序acceptance；本轮独立Browser仍不可用。

UNVERIFIED：本轮删除支持块后的独立现场点击、视口/主题视觉；生产尚未部署，不将本地SSR或构建代替生产验证。主agent另行本地现场与静态构建。

观察：Caption当前class出现重复editorial-caption，语义/样式无影响，不作为发布阻断或扩展修改要求。

实际命令：Python urllib.request请求首页、/p/editorial-reference、/p/demo-ep1，并解析支持块文案、导航链接、继续阅读、要点/Caption；git diff/status核对发布范围；cat/rg读取最终source及docs。复现前提：按先前README启动隔离4115 API与3016预览；可curl对应3路径核对保存HTML。工件与本地文章数据不应进入生产提交/数据库。
