# 独立验收：内容主体设计图 v2

- 时间：2026-10-13；验收者：独立子 agent `feed_actions_design_acceptance`。
- 对象：`yoryon-feed-body-v2.png`；代码版本：`b8e7098e941f80d899cd6483a9ce236732e5ddf6`（当前工作区代码只读检查）。
- 图片 SHA256：`c242e6e329b20e846054a1368640156aad16f01367a5790a979469885be228c6`。
- 环境与数据：本地静态图片及现有源代码；无登录、数据库、生产请求或新增验收数据。图中 10 / 176 为视觉示意。

## 结果

**PASS（静态可见设计）**：实际用 `view_image` 检查图片。保留浅蓝外背景、白色单列阅读区及两行网站页头；无侧栏、手机框或 App 导航；四个内容条目内无头像和 @。三个媒体条目的日期位于标题右侧，长文日期位于预览上方右侧；四条底部均按评论气泡、点赞空心心形、转发双箭头顺序排列。转发仅有“转发”文字，无转发数字、渠道选项、渠道统计、浏览量或书签等额外动作。标题、正文、元数据及动作文字可辨认。

**PASS（现有代码状态核对）**：`comment-section.tsx:145` 的 `toggleLike` 接受 `CommentItem | ReplyItem`，调用 `/api/comments/:id/like`；`comments.ts:282,297` 对应评论点赞/取消点赞。当前 `FeedContentItem` 未定义内容点赞状态或计数；`FeedTimeline` 未呈现内容点赞/转发操作。对应用路由、组件、核心及数据库的关键词搜索未发现内容点赞或 clipboard 操作。

**UNVERIFIED（交互）**：静态图不能验证评论跳转、点赞持久化、复制链接、成功提示、失败反馈或无障碍操作。“转发只复制链接”的语义由 `design-basis-v2.md` 与 `prompt-v2.txt` 声明，图片只能证明没有渠道统计或额外转发数字。本轮未实现或运行这些交互，也未将示意数字作为实际业务统计。

**UNVERIFIED（浏览器尺寸）**：图像显示单列设计，未在浏览器加载新实现，因此不能据此确认真实 CSS 宽度、排版或点击区域。未运行构建与测试，它们不能补足本轮静态图的交互证据。

## 实际检查与复查方式

工作目录：`/Users/yoryon/Projects/yoryon`。

```sh
git rev-parse HEAD
shasum -a 256 artifacts/feed-body-concept-20261013/yoryon-feed-body-v2.png
rg -n 'toggleLike|likeCount|clipboard|Clipboard|分享|转发|详情与评论|FeedContentItem' apps/web/components/feed-timeline.tsx apps/web/components/comment-section.tsx apps/web/lib/types.ts apps/api/src/routes/comments.ts
sed -n '1,210p' apps/web/components/feed-timeline.tsx
sed -n '1,35p' apps/web/lib/types.ts
sed -n '135,165p' apps/web/components/comment-section.tsx
sed -n '275,312p' apps/api/src/routes/comments.ts
rg -n 'clipboard|Clipboard|navigator\.clipboard|likeCount|/like' apps/web/app apps/web/components apps/api/src/routes packages/core/src packages/db/src
cat artifacts/feed-body-concept-20261013/design-basis-v2.md artifacts/feed-body-concept-20261013/prompt-v2.txt
```

可见结果复查：调用 `view_image` 读取 `/Users/yoryon/Projects/yoryon/artifacts/feed-body-concept-20261013/yoryon-feed-body-v2.png`，核对上述布局与四条动作栏。未新增可执行测试文件，未修改应用、数据库、运行中预览或其他工件。
