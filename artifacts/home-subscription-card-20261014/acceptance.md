# 首页订阅支持卡片独立验收

结果：PASS。

环境：本地 Web http://localhost:3015/，533 × 896 CSS 像素；隔离 API 127.0.0.1:4115，隔离数据库 yoryon_page_redesign_20261013。独立 agent 创建并关闭自己的 @Browser 标签，不使用用户原有标签。

- PASS：首页底部订阅支持呈现完整淡边框圆角卡片，470 × 86；边框 1px、圆角 12px，四侧 padding 20px。
- PASS：背景透明，与页面融为一体，无阴影。文案“更深入的作品，更直接的交流。”和“了解订阅”完整，未横向溢出（scrollWidth 518 ≤ viewport 533）。
- PASS：真实点击“了解订阅”后页面 URL 为 /subscription，显示会员状态与会员作品；浏览器 back 返回首页。
- PASS：恢复自己的视口 override 并关闭标签。未登录、退出、修改 theme、资料、点赞或转发。

证据：geometry.json、acceptance-home-533.png。截图是 533 × 896 实际 CSS 视口对应文档坐标截取，未修图。

匿名统计清理：精确自身 session ID 存在私有 /tmp/home-subscription-card-acceptance-sid.json，交给主 agent 按隔离数据库精确删除自身记录；不通过时间推断，不将 ID 写入工件。最终清理回执由主 agent 补充。

UNVERIFIED：其他宽度、深色主题及会员购买/兑换流程，本次仅验证新增卡片与已有导航。
