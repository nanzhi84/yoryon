# Notion 换行与经济学格式同步独立验收

2026-10-14，Asia/Singapore；publication_acceptance 子 agent。生产只读匿名 GET，无代码变更，不需构建；未修改业务数据或发邮件，未新增测试程序。

PASS：源与发布稿逐个非空块/行完全相符。三个经济学源头cover标签与图片沿用既有封面元数据，除此之外标题、强调、段落边界、列表和措辞全部保留；每个Notion empty-block在同一相对位置对应一个独立 &#160; 段落。frontmatter和日期完全未变，3个本地封面PNG与原发布稿字节一致。source-fidelity.json保存逐项结果。

PASS：实际生产HTML仅在 data-search-content 正文DOM区域解析 p/h2/h3/li/hr，以每个节点完整文本（包含搜索span子节点）比较；所有正文块类型、顺序与文本均和发布稿一致。NBSP空白段实际数量分别5/1/1/1，相对位置分别[5,14,22,31,37]/[24]/[26]/[33]（从0计数），准确匹配Notion；不是仅去空白全文比对或全HTML含RSC重复计数。经济学h2为4/3/3，最后一篇5条无序列表文本与边界完整保留；原文所有普通段落仍为独立p。日期04.02/05.08/05.09/05.10保持，匿名正文全文可见。http-results.json含实际与预期完整块序列。

PASS：发布前后普通URL响应确有变化，生产已返回新空白段及新标题格式。首页对应封面响应字节与此前独立验收的生产WebP完全相同，证明本次媒体未变（media-results.json和*-cover.webp）；不宣称Notion最新附件逐字节一致。meritocracy无封面，符合既有状态。

UNVERIFIED：浏览器实际段间距像素效果、桌面与移动视觉。本会话内置Browser此前确认不可用，本轮未反复试错；HTML中独立NBSP空段存在及位置已实测，不能代替最终视觉判断。

复核：`curl -fsSL https://yoryon.com/p/<slug>`（slug见manifest）以及首页；实际HTML保存为*-production.html，发布前为*-before.html。用Python标准库html.parser限制正文data-search-content范围，按p/h2/h3/li/hr提取顺序与完整textContent，和posts/<slug>/index.md逐块比较，将&#160;解码为NBSP；媒体URL见media-results.json，可重新GET后用shasum -a 256核对。前提是本次发布仍在线。工件仅含已公开内容、媒体与无敏感信息回执。
