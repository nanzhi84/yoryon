# 主agent真实浏览器现场证据

执行表面：用户交付的内置Browser tab4。桌面viewport1280×1000：标题31px居中，卡片宽660px、背景rgb(243,243,242)、3点；参考文章其他2个普通ol保持。reference-desktop.jpg。

375×812：document clientWidth=360，scrollWidth=360；卡片宽312px，粗体首段display:block，编号伪元素宽22px。reference-mobile-light.jpg。账户菜单→深色外观：卡片rgb(31,41,47)，编号背景rgb(228,225,218)，reference-mobile-dark.jpg。结束恢复浅色并viewport.reset()。

真实搜索：/search输入“从读者路径倒推”→搜索→结果中的“定位原文”→editorial-notes要点卡片。最终aside显示“正文命中 1 / 1”，CSS.highlights search-hit size=1，Range.toString精确为“从读者路径倒推”，无alert；search-summary-highlight.jpg。不存储搜索会话定位token。

首次搜索返回“请求来源非法”：本地3016进程沿用只允许3015的ALLOWED_ORIGINS。仅停止本任务97960进程，使用ALLOWED_ORIGINS=http://localhost:3016 SITE_URL=http://localhost:3016重启同一dev副本。未更改生产安全规则、API或3015；没有禁用CSRF。随后真实搜索与定位通过。

未写评论、点赞、账号、邮件等业务数据；沿用用户交付tab，不删除用户自己的浏览/搜索会话。样例按用户要求保留。最终交付页面恢复reference文章，无搜索fragment。
