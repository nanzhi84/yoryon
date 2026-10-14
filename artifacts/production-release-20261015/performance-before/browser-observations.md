主 agent IAB 自有标签 8（https://yoryon.com，默认缓存、无网络节流）实际点击 2026.09.27 短帖展开：先出现“加载中…”，随后末段“管理真的是个很困难的事情。”及“收起”可见。一次外部 wall-clock 测量（Date.now 包围 locator.click + 末段 waitFor visible）为491ms，包含工具往返开销，不能当作精确浏览器主线程耗时或统计中位数。

真实点击“先自由后财富”后，后续 DOM snapshot 和 URL 确认进入 /p/freedom-before-wealth，main 的 h1、多个章节和完整正文可见。首次计时错误使用不支持的 role level 参数，得到321ms只对应标题匹配，丢弃该数值。改用main h1后导航工具再次超时，未取得有效详情精确计时。

主/子 agent 多次 CDP Runtime.evaluate/新标签/导航工具超时，子 agent还报告 browsers空列表。不能把这些20–30秒工具超时归因网站性能。公开网络采样另存，不替代点击/骨架/正文可见测量。未改生产内容或配置。
