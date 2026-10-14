# 日期与互动栏设计稿

本轮继续用户已确定的单列内容主体设计范围，交付静态图片。保留浅蓝色调、站点页头和现有阅读宽度，内容条目不增加头像或 @。

日期移回每个条目的上方；底部按评论、点赞、转发排列。参考用户提供的 X 互动栏截图绘制轻量线框图标，只保留三项。转发语义为复制内容永久链接，没有转发数字、渠道选择或渠道统计。评论和点赞数字均为视觉示意。

现有代码确认：apps/web/components/comment-section.tsx:145 的 toggleLike 与 apps/api/src/routes/comments.ts:282、297 实现评论和回复点赞；FeedContentItem 与当前 FeedTimeline 未包含内容本身的点赞状态、计数或复制链接操作。本稿不代表帖子/文章点赞或转发已经实现，不修改应用代码和运行中的本地预览。

工具为内置 imagegen。编辑参考：yoryon-feed-body-v1.png 与用户附件 codex-clipboard-1393daa2-86ac-4bcf-bdd3-affea062976d.png。完整提示词为 prompt-v2.txt。独立验收仅检查设计图可见结果与范围，不将静态图片当成交互验收。
