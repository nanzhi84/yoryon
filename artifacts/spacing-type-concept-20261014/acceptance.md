# 生图设计独立视觉验收

- 日期：2026-10-14，Asia/Singapore。
- 验收人：独立子 agent `spacing_type_concept_review`。
- 范围：用户最新三条标注对应的三张 image_gen 图稿及后续实现可行性。本轮未操作浏览器、主题或认证，未修改应用源码或业务数据。
- 前提：已读取本目录 `design.md`；以用户提供的当前页面截图为旧版视觉证据。三张 PNG 均通过 `view_image` 实际查看，尺寸通过 `sips` 读取，SHA-256 与 `manifest.json` 核对一致。
- 总体结论：**PASS，限于视觉方向与静态图稿**。未发现阻断使用的文字错误。精确 CSS 数值及真实交互结果为 **UNVERIFIED**，本报告不代表页面已经实施。

## 三张图稿

| 图稿 | 结果 | 实际可见证据 |
|---|---|---|
| `home-v2.png`，927 × 1697 | PASS | 音频、长文、视频采用同一无围合背景的单列信息流。标题、正文、类型/标签、互动组成紧凑的内部组；条目间用较宽留白和淡细线分开。标题高于正文，日期和标签更小、更淡。日期保留在条目上方右侧，底部为评论、点赞、转发。未出现条内作者头像、@、App 侧栏或底部导航。 |
| `article-v1.png`，973 × 1616 | PASS | 返回位于主体左上。正文、继续阅读、评论之间恢复浅色细线与留白。合集上下篇为两列、同页面背景、轻蓝灰边框的卡片；不可用上一篇呈灰色，可用下一篇有蓝色提示与标题。没有大阴影、渐变或重背景卡片。 |
| `subscription-v1.png`，971 × 1620 | PASS | 会员作品/会员问答是两个主 tab，当前会员问答选中。公开问答空态只有图标和文字，下方没有分割线或围合卡片。顶部订阅说明与价格直接置于页面背景，未恢复夸张 VIP 卡片。 |

## 间距、字号及文字检查

信息流相对用户提供的旧图，标题到音频、音频到文字、文字到标签和互动的留白明显收紧；块之间的分组边界更明确。中文内容、日期、价格、上一篇/下一篇状态均可读，未见严重乱码、错误日期或语义冲突。图稿中音频/长文/视频用于覆盖不同内容形态，排列顺序不能作为改变实际首页排序的依据。

**UNVERIFIED：精确尺寸。** 生图会偏移实际像素比例，例如首页 PNG 按 525 CSS px 等比理解时，左右页边距目测约 37 px，而 `design.md` 指定 24 px；部分互动文字与图标也比设计表中的 13/17 px 更大。三张 PNG 宽度亦不完全相同。这些不影响本轮视觉方向通过，但后续实施必须以 `design.md` 中的 CSS px 参数为准，并用真实 525 px 宽页面复核，不直接抄取 PNG 像素。

**UNVERIFIED：真实行为。** 静态图不能证明一击播放、控件稳定、返回位置、按钮点击、复制链接、tab 切换、加载/错误/空态、键盘或屏幕阅读器行为；长标题、多行正文与不同内容长度也尚未在运行页面验证。

## 实现可行性

从图稿和设计参数判断，本方案可用现有单列页面、字号/行高/间距、浅色边线及两列合集导航实现；无需增加新的内容领域或改变媒体与互动语义。这是实现可行性判断，未进行代码实施验收。

## 可复核命令与工件

工作目录：`/Users/yoryon/Projects/yoryon`。无需数据库、认证或生产数据。

```sh
sips -g pixelWidth -g pixelHeight artifacts/spacing-type-concept-20261014/home-v2.png artifacts/spacing-type-concept-20261014/article-v1.png artifacts/spacing-type-concept-20261014/subscription-v1.png
shasum -a 256 artifacts/spacing-type-concept-20261014/home-v2.png artifacts/spacing-type-concept-20261014/article-v1.png artifacts/spacing-type-concept-20261014/subscription-v1.png
```

已执行尺寸读取及哈希核对，返回码均为 0。对应 SHA-256：

```text
home-v2.png          8a664716d1b40af4161cfee360e5837e724a59c197b8eabde41f04f9180c7aa1
article-v1.png       a839d5b006533065532ec84e57ba2201a1b3b0a4077280a516c6dcedd0e5051d
subscription-v1.png  dfdec9c5f7c39f0d035084ae650912d589965130f1c2618c9c547f501594bb5c
```

生成输入保存在 `prompts.json`，约束保存在 `design.md`，图片元数据与摘要保存在 `manifest.json`。相同 prompt 可用于重新生成视觉方向，但生成模型不保证逐像素一致；本轮可精确复核的是已保存 PNG 与其 SHA-256。
