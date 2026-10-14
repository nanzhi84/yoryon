# 主agent浏览器现场

内置Browser新建本任务专用tab访问http://localhost:3016/p/editorial-reference，不操作用户已有两个tab。DOM实际getComputedStyle(document.body).backgroundColor浅色rgb(255,255,255)，--canvas=#ffffff；要点卡片rgb(243,243,242)。截图background-light.jpg。

账户菜单→深色外观→Escape关闭菜单：body背景rgb(21,21,20)、--canvas=#151514、dark class=true；要点卡片rgb(31,30,28)。截图background-dark.jpg。参数与参考原CSS一致，background-computed.json保留回执。

完成后恢复浅色，关闭自身tab；cleanup.json仅清自己SID的隔离统计事件。用户业务内容、账号、其他tab和生产保持。没有新增测试程序。文档边界由独立agent按源码核查，不将静态或HTTP成功当成用户路径通过。
