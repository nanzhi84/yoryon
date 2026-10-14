# 独立发布验收

执行日期：2026-10-14（Asia/Singapore）。执行者：publication_acceptance 子 agent。代码版本：8b8cdc247358ef4b1a1893d42d109c1f0589854d。

环境与数据前提：生产 https://yoryon.com，匿名只读 GET；待发布内容由主 agent 根据实时 Notion 整理到 posts/，manifest.json 列明写作日期、源文件与限制。未写入生产业务数据、未发邮件、未创建固定测试程序。

## 结果

|文章|日期|标题与全文文本|首页入口|封面|
|---|---|---|---|---|
|经济学十大原理（1）：人们如何做出决策|2026-05-08 PASS|PASS|PASS|PASS：有效 WebP|
|经济学十大原理（2）：人们如何相互影响|2026-05-09 PASS|PASS|PASS|PASS：有效 WebP|
|经济学十大原理（3）：整体经济如何运行|2026-05-10 PASS|PASS|PASS|PASS：有效 WebP|
|巴菲特：当前美国股市像是赌场|2026-05-02 PASS|PASS|PASS|PASS：有效 WebP|
|先自由后财富|2026-10-09 PASS|PASS|PASS|无封面，符合源稿|

PASS：文章匿名公开 HTML 中的标题、写作日期均符合 manifest；去除 Markdown 标题、加粗、列表标记、分隔线与空白后，源稿全文完整连续出现在可见 HTML 文本中，覆盖正文首尾及中间全部段落。该比较验证文本完整性，不评价视觉排版。

PASS：首页可进入五篇，顺序为《先自由后财富》（10.09）→ 经济学（3）（05.10）→ 经济学（2）（05.09）→ 经济学（1）（05.08）→ 巴菲特（05.02），符合写作日期倒序。第五篇发布期间首次首页尚未刷新，最终重新 GET 已出现。

PASS：四篇封面首页 alt 对应正确标题；实际媒体资源非空、WebP 签名正确，file 识别为 1080×540 或 1280×640 图像。正文无重复封面 img，封面用于首页卡片。生产媒体 SHA-256 与字节数见 independent-http-results.json。

UNVERIFIED：桌面和移动端真实浏览器视觉、点击后路由与加载结果。内置 Browser 在子 agent 创建 visible:true/false 均返回 “IAB visibility is not supported in a subagent thread”；不带 visible 两次超时（30/60 秒）。未使用 Chrome 用户会话作为替代。HTTP 内容证据不能替代此项。

UNVERIFIED：搜索结果用户可见日期。未调用会持久化 search_sessions 的搜索 POST，保持本次独立验收只读范围；现有前端日期截取是否造成前一天，需主 agent 另行判定。

UNKNOWN：Notion 新附件与发布封面的逐字节一致性。已知封面来自按文章匹配的 PaperNotes 本地原图；未取得 Notion 新附件字节，生产响应为转换后的 WebP，不宣称与 Notion 原附件哈希一致。

## 可重复命令与证据

在仓库根目录执行 `curl -fsSL https://yoryon.com -o artifacts/economics-publication-20261014/homepage-production.html`；对 manifest 中每个 slug 执行 `curl -fsSL https://yoryon.com/p/<slug> -o artifacts/economics-publication-20261014/<slug>-production.html`。使用 Python 标准库 html.parser 忽略 script/style 提取文本，再与 posts/<slug>/index.md 的正文去除 Markdown 格式比较；逐项实测结果保存 independent-http-results.json 和 <slug>-visible-text.txt。最终首页 HTML 可直接核对 href 顺序与日期。封面 URL 在该 JSON 中，对其执行 `curl -fsSL https://yoryon.com<url> -o <slug>-production-cover`，然后 `file artifacts/economics-publication-20261014/*-production-cover` 和 `shasum -a 256 artifacts/economics-publication-20261014/*-production-cover` 可复核类型与字节证据。

验收工件仅包含公开文章 HTML、正文、公开媒体和无敏感信息回执；未产生需要清理的隔离业务数据。

## 第六篇追加验收

《被优绩主义腌入味后，连痛苦都被剥夺了正当性》（meritocracy-and-pain）：PASS。发布前首次匿名 GET 为 404；主 agent 通知发布完成后重新 GET，公开 HTML 标题、2026.04.02 日期、去 Markdown 格式后的全文连续匹配源稿，正文首尾与全部中间段落齐全。无媒体，符合源稿。首页入口 PASS，位于 2026.05.02 巴菲特之后，符合六篇按写作日期倒序。结果合入 independent-http-results.json，公开 HTML 与提取文本已留存。浏览器视觉仍 UNVERIFIED，未重新尝试。全程只读，未创建生产业务数据。
