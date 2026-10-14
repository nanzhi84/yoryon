# 独立现场验收

时间：2026-10-14（Asia/Singapore）。源码基线 ce35856b3cb1f794439dea7e986c6f55e8462b33 + 本轮未提交排版变更。环境见 environment.json；独立内置 Browser tab 1，未操作3015、生产数据或邮件。

## PASS

- 首页实际展示公开音频、视频、图集、系列文章及轻量订阅支持行；现场点击“示例系列 · 第一话”进入 /p/demo-ep1，点击“下一篇 示例系列 · 第二话”进入 /p/demo-ep2，“返回上一页”恢复第一话，“首页”返回内容流。
- 桌面1280px：正文实际CSS为17px / 31.45px（1.85），宽660px；标题与正文衬线字体栈包含Songti SC。继续阅读、评论与导航为系统无衬线字体。中文实际视觉为书刊样式。
- 375×812：正文为16px / 29.6px，宽312px；document.documentElement.scrollWidth=360，不超过视口375。首页图片自然宽640px、实际宽312px、complete=true；视频封面与图集可见，没有页面横向溢出。
- 账户菜单深色外观开关现场切换，深浅两种文章文字、层级及控件可见。结束恢复浅色与默认视口、关闭独立tab。

## UNVERIFIED

- 样本文章很短，无代码块、长链接、表格或长文多章节；这些边界没有真实内容可供现场验收。
- 媒体可见性已核对，但未实际播放音视频，也未验证图集放大；付费内容与授权边界未验收。
- 字体栈、字号与视觉已核对，未从浏览器字体诊断确认每个字符最终匹配的具体字体文件。

## 实际操作与复现

先按 README.md 启动隔离API及3016，再用内置Browser访问 http://localhost:3016。真实点击上述首页→第一话→下一篇→返回路径；账户菜单→深色外观；viewport.set({width:375,height:812})核对移动端，最后viewport.reset()。DOM只读核对使用 getComputedStyle(p)、p.getBoundingClientRect().width 与 document.documentElement.scrollWidth。此记录为现场回执，不新增测试程序。

Network.setExtraHTTPHeaders CDP返回“不支持”；没有启用DNT。通过Runtime.evaluate只读确认本验收SID d0abea11-198f-415e-b05c-3ad266fe951c。关闭tab后，在明确数据库名为yoryon_page_redesign_20261013的连接上执行：

```sql
DELETE FROM analytics_events WHERE session_id IN ('be21bdde-e11e-4550-9b10-b6fa40adeb03','d0abea11-198f-415e-b05c-3ad266fe951c');
SELECT count(*) AS remaining_own_events FROM analytics_events WHERE session_id IN ('be21bdde-e11e-4550-9b10-b6fa40adeb03','d0abea11-198f-415e-b05c-3ad266fe951c');
```

回执：DELETE 0；remaining_own_events=0。仅清理本轮两个SID，未影响其他记录；环境连接字符串未写入工件。

截图：home-desktop-light.jpg、home-mobile-light.jpg、article-desktop-dark.jpg、article-mobile-dark.jpg、article-mobile-light.jpg。
