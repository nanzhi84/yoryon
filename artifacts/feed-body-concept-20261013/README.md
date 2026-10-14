# 单列内容主体新稿

当前交付：yoryon-feed-body-v2.png（948 × 1659）。日期移到上方，底部依次为评论、点赞、转发；转发只复制链接，不展示转发次数或渠道统计。互动数字为设计示意。继续保留单列阅读宽度和浅蓝色调，条目没有作者头像或 @。本轮只更新静态图片，应用代码和 localhost:3015 预览未改。

v2 的提示词与范围分别见 prompt-v2.txt、design-basis-v2.md；receipt-v2.json 保存生成回执与文件摘要，独立复核见 acceptance-v2.md。复生成时将 prompt-v2.txt 输入内置 imagegen，并附 v1 原图和用户提供的 X 互动栏截图；输出具有随机性。可用 `shasum -a 256 artifacts/feed-body-concept-20261013/yoryon-feed-body-v2.png` 与 `sips -g pixelWidth -g pixelHeight artifacts/feed-body-concept-20261013/yoryon-feed-body-v2.png` 复核保存文件。

以下为 v1 留存记录。

交付：yoryon-feed-body-v1.png（948 × 1659）。一个现有阅读宽度与一张网页稿，页头保持原有两行结构。条目中没有作者头像、作者名和 @，重点改善音频/视频/图片与长文的呈现，以及日期、类型、标签和详情评论入口的层级。

本轮只生成静态设计图，不修改应用。参考现有真实首页截图，内置 imagegen 编辑，提示词 prompt.txt，设计范围与示意说明见 design-basis.md。原音频标题和shownotes保留；媒体缩略图、波形及文章简介为视觉示意。独立静态复核见 acceptance.md。

复生成：给内置 imagegen 输入 prompt.txt，并使用 ../page-redesign-20261013/browser-home-final.jpg 作为参考图。输出具有随机性；receipt.json 记录本次文件尺寸与SHA-256，可用 shasum -a 256 yoryon-feed-body-v1.png 与 sips -g pixelWidth -g pixelHeight yoryon-feed-body-v1.png 复核。图不证明精确CSS像素或交互行为，本轮未运行无关构建或新增测试程序。
