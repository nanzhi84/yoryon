# 本地设计依据

日期：2026-10-13（Asia/Singapore）。源码版本：b8e7098e941f80d899cd6483a9ce236732e5ddf6。

用户明确要求以本地代码库为设计依据。最终设计不使用生产页面及其截图作为参考。

- 本地目录：/Users/yoryon/Projects/yoryon
- 参考源码：apps/web/components/site-header.tsx、feed-timeline.tsx、membership-panel.tsx、member-questions.tsx、apps/web/app/globals.css、layout.tsx、page.tsx、subscription/page.tsx。
- 当前源码的匿名页面：从本地源码复制到临时目录，复用安装的依赖；Next dev 端口 3015，API 固定为本地 127.0.0.1:4100；不启动或修改数据库。
- 浏览器观察：首页有两行导航（品牌、搜索、通知、账户；首页、订阅、探索），720px 阅读列、白色背景、系统无衬线字；内容包括帖子、长文、图集和音频。
- 订阅页：¥29.9/月，专属作品、每月一次会员问答、会员讨论；入口为兑换激活码。匿名状态下公开问答为空，可查看会员作品介绍及公开预览。
- 设计变更：保留结构和功能语义，订阅引入炭黑会员卡、极少量暖金色、象牙色主按钮。内容与配图仅作设计示意。
- 本次交付范围：静态设计图；不改产品代码或实际会员权益。
