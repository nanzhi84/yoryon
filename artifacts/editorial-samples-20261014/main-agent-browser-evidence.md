# 主agent真实Browser补验

浏览器：交付中的内置Browser tab4。viewport.set({width:375,height:812})，结束reset恢复默认，最终打开reference文章。没有创建评论、点赞、账号或发邮件；沿用用户交付tab，未删除用户浏览会话的统计。

PASS：现场进入 /p/editorial-notes。getComputedStyle(pre).overflowX=auto，pre.clientWidth=312、scrollWidth=1352；document.documentElement clientWidth=360、scrollWidth=360，阅读列312。点击pre将它滚入视野，原生向右scroll后pre.scrollLeft=360，页面scrollWidth仍360。长URL完整文字在同一正文列，页面无横向溢出。证据notes-mobile-code.jpg。

PASS：进入 /p/editorial-visual，两张图片complete=true，naturalWidth=1200/720、渲染宽312，页面scrollWidth=360。第一次点击发生在客户端加载完成前、没有弹层；待页面交互就绪后再点实际图片按钮，AX显示“图片预览，按Esc或点击空白关闭”和图片。按Escape关闭后恢复正文。截图visual-mobile-lightbox.jpg、visual-mobile-article.jpg。

参考文章最终页面：reference-article.jpg。最终原文保留日期、代码与文献，卡片转小标题，流程按段落；原文链接保留。原站CSS高亮、轮播、原图布局仅在/reference-article.html原版对照，未声称Yoryon Markdown能够像素级复刻。
