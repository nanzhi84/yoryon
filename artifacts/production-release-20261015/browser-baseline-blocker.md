# 独立浏览器性能基线：UNVERIFIED

2026-10-15 再次接手生产基线时，之前成功使用的 IAB browser 2 返回 `Browser is not available: 2`。随后 `cua.getState()` 的浏览器清单为空；调用 `cua.createBrowserTab("iab", "https://yoryon.com/", {visible:false})` 仍返回 `Browser is not available: iab`。

因此本子 agent 未产生生产点击到展开/详情完成的性能数字，也未将 HTTP 请求耗时当作用户交互耗时。前述本地发布格式的截图与 DOM 几何来自浏览器仍可用时的真实执行，不受此后环境不可用影响。

生产基线由主 agent 当前仍可用的浏览器会话继续；若只能取得工具调用墙钟时间，应明确包含工具传输和等待开销，不能冒充准确的页面渲染延迟。
