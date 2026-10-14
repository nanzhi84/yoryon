# 生产浏览器验收

环境：Codex 内置 Browser，匿名，https://yoryon.com；部署 b2470bc0320b9a88f809467cd43b84e36fad65a2。

- PASS：首页实际显示 3 篇公开文章，无底部订阅支持块；主导航订阅仍存在。证据 production-home.jpg。
- PASS：从首页点击 Jev 文章，正文、媒体、标题正常显示。读区宽 660px，标题 31px / 600，居中；字族为文档所列 Iowan / Palatino / Georgia / Songti 回退栈。证据 production-article.jpg。
- PASS：浅色 body 背景 rgb(255,255,255)，主题菜单切换后深色 rgb(21,21,20)，随后恢复浅色。
- PASS：订阅页仍显示会员权益和公开空态；未执行购买、登录、评论、点赞或发布。
- PASS：文章页浏览器 error 日志为空。
- UNVERIFIED：生产现有文章没有合集及上下篇数据，相关行为仅在隔离本地样例验证；跨操作系统字体实际回退未覆盖。

操作方式：Browser.goto 首页 → 文章链接 click → DOM snapshot、getComputedStyle 读取 → 账户菜单主题切换和恢复 → 订阅页 → 关闭独立验收标签。
尝试为独立标签注册 DNT 初始化脚本时，CDP 明确不支持，未生效；之后执行普通公开浏览，可能产生网站正常访问统计。未主动调用业务写入接口。
