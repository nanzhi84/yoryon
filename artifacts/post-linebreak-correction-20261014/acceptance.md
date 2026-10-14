# 八条帖子保留换行、去空行修正独立验收

2026-10-14，publication_acceptance 子 agent，生产匿名只读GET，无代码变动。

PASS：8条新稿恢复初始dated-posts-20261014稿的每一非空行；行文字、标点与顺序逐项一致，仅移除空白行并添加Markdown硬换行。frontmatter全未变。硬换行数按manifest顺序为2/3/4/3/1/2/5/1。source-results.json记录逐条源保真。

PASS：逐篇GET普通生产URL，在data-search-content正文DOM内以p为段落、br为行边界（兼容搜索span子节点）重建行数组；八篇均恰1个p，每个br数量符合manifest，所有行文本与顺序逐项完全匹配。日期保持，实际不是全文去空白比较。每篇实际行数组、p/br结果见http-results.json，原始公开响应见*-production.html。

UNVERIFIED：浏览器实际视觉行距与自然折行。内置Browser本会话已确认不可用，依指令不重复尝试。本轮仅内容更新，日期右侧前端不变。

复核：`curl -fsSL https://yoryon.com/p/<manifest-slug>`；Python标准库html.parser仅在data-search-content区域按p与br分割，合并span文本后比较manifest.lines，不能以去空白全文替代。需要本次发布仍在线。无新增测试程序、fixture、生产数据写入或邮件，不需清理业务数据。
