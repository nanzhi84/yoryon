# 主 agent 浏览器验收

环境与数据前提见 README.md。工具：内置 @Browser（CUA）。本次子 agent CUA 不可用，以下路径由主 agent 现场执行，独立 API 验收及截图复核见 independent-acceptance.md，不称作子 agent 独立浏览器执行。

PASS：打开 /c/editorial-preview，8篇章节中7篇免费、1篇会员。封面 img 实际 complete=true、naturalWidth>0，src=/api/media/fb267650-8b78-47f2-9d36-c6403293af92。默认704px视口无横向溢出。

PASS：点击目录01进入 editorial-essay → 点击底部“下一篇 一篇文章如何到达读者：从草稿、媒体到浏览器的技术手记” → 第二篇顶部是“返回合集”链接 → 点击后实际URL为 /c/editorial-preview?flow=cd58f405-3cae-4903-8625-00ed2983fc7d，直接返回目录而非第一篇，flow保持。

PASS：从目录点击08会员示例，页面显示付费标签、公开段落、“本内容为订阅专享，以上为免费预览。”及兑换订阅入口；会员正文示例标题及正文不可见。

PASS：375×812窄屏合集封面实际加载，封面宽96px，documentElement.scrollWidth=360，innerWidth=375，无横向溢出。完成后恢复默认视口，保留合集目录供用户查看。

可重复操作：打开 http://localhost:3000/c/editorial-preview，按上述链接顺序点击；无需登录。截图 collection-desktop.jpg、collection-mobile.jpg、paid-preview.jpg。

未覆盖：有会员权益账号的付费正文解锁、网络失败重试交互、多浏览器、生产部署。普通文章回退与伪造合集的导航行为只经源码/独立API核对，未现场点击。
