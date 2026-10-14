# 16 条日期帖子独立验收

执行日期：2026-10-14，Asia/Singapore。执行者：publication_acceptance 子 agent。版本：8b8cdc247358ef4b1a1893d42d109c1f0589854d。环境：生产 https://yoryon.com，匿名 GET；输入基线为主 agent 保存的 source.txt、manifest.json 和 posts/。本子 agent 未取得本轮新增用户消息原始上下文，故用户输入到 source.txt 的抄录本身由主 agent 负责；本报告独立核对 source.txt 之后的链路。

PASS：16 条源稿与 source.txt 对应分段的措辞、行分隔、空行及列表完全一致，仅在需要保留硬换行的行末补 Markdown 两空格。含最终换行的正文 SHA-256 全部符合 manifest。见 source-fidelity-results.json。

PASS：16 条匿名详情 HTML 的日期均为用户所标日期；去空白及列表显示标记后，完整正文连续匹配源稿，覆盖首尾和所有中间段落。明确检查了长篇 09.09、列表帖 09.08 和 07.23，以及短帖、同日两帖。所有详情实际文本保存在 *-visible-text.txt，响应保存在 *-production.html。

PASS：生产匿名 feed 返回 type=post、空 title、public、对应日期 UTC00:00；没有编造标题。两页游标依次获取后，16 个 slug 各出现一次。所有非置顶内容 publishedAt 倒序；04.24 两帖拥有独立 slug、独立详情与不同正文，均在 feed 中且互未覆盖。首页第一屏 SSR 含 12 条本次帖子和“加载更多”，后 4 条（04.24 两条、04.21、04.20）经实际 /api/pages/<version>/feed/<cursor> 第二页可取得。feed-page-1.json、feed-page-2.json 与 feed-all-items.json 留存回执。

PASS（数据与详情路径）：长帖 feed collapsed=true 且提供截断预览；首页存在“展开”入口，匿名详情返回完整正文。详情完整性已验证，真实点击展开后的客户端表现仍未验证。

FAIL（已知视觉呈现）：无标题数据在现有页面被回退显示“未命名内容”。16 个详情 h1 均如此，首页 SSR 可见本次 12 条也显示该回退。数据 title 确为空，原文和日期发布没有因此失败；此次未修改前端代码或部署。此项是“无标题”可见效果与预期不一致的已知问题。

UNVERIFIED：浏览器桌面/移动端视觉、真实“加载更多”和“展开”点击及段落排版。本次按要求仅尝试一次内置 Browser，返回 “Browser is not available: iab”；未使用用户 Chrome 会话替代。HTTP/JSON 结果不能代替浏览器交互验收。

## 复核命令与前提

需要公网能够访问生产，且本次发布记录仍存在。仓库根目录运行 `curl -fsSL https://yoryon.com/api/feed` 获取 version 与 nextCursor；随后对游标执行 `curl -fsSL https://yoryon.com/api/pages/<version>/feed/<url-encoded-cursor>`。各详情用 `curl -fsSL https://yoryon.com/p/<manifest-slug>`，首页用 `curl -fsSL https://yoryon.com`。使用 Python 标准库 html.parser 忽略 script/style 提取响应可见文本，与 posts/<slug>/index.md 去 frontmatter、空白和 Markdown 列表标记后的正文比较；逐条结果在 http-results.json。源稿逐行检查仅移除行末空格，保留行顺序及空行，并以 hashlib.sha256(body.encode()) 对 manifest 复核。

只进行了匿名 GET 和本地工件写入，未写生产业务数据、未发邮件、未新增可执行测试程序，无需清理业务验收数据。
