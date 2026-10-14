# X 风格新信息流设计图

交付：yoryon-x-feed-v1.png，1536 × 1024，桌面与手机并列。使用内置 imagegen，提示词 prompt.txt；原头像及上一版浅蓝稿用作身份和色调参考。本轮仅设计图，当前应用代码与上一轮本地预览保持一致（receipt.json）。

布局：桌面左导航、中间600px级连续信息流、右侧作者/订阅/合集；每条左头像、作者/账号/日期一行，正文、媒体或长文预览嵌入同一条目，评论/详情/分享放在底部。手机使用相同条目布局并收纳导航。订阅维持小面积浅蓝区块与29.9/月、激活码入口。

参考事实与本方案推断见 design-basis.md。X 公开 HTML、CSS、入口脚本通过无 Cookie GET 保存，回执 reference-receipt.json。CSS实际主列/导航/右栏参数可检查；本方案缩窄右栏和品牌色属于自己的设计选择。

独立静态看图验收见 acceptance.md。示例文章、图片、音频时间/波形及互动入口均为设计示意；当前网站已有评论、长文/帖子与混合媒体，分享/分类筛选是视觉提案，不代表已实现。

复生成：以 prompt.txt 为描述，用内置 imagegen，参考图依次为 ../design-concept-20261013/avatar-reference.jpg（身份）、../design-concept-20261013/yoryon-local-design-v3.png（配色）。生成图不保证逐字节一致，本次确切文件SHA-256与尺寸保存在 receipt.json；可用 shasum -a 256 yoryon-x-feed-v1.png 和 sips -g pixelWidth -g pixelHeight yoryon-x-feed-v1.png 复核。本轮未新增测试程序或运行与静态图无关的构建。
