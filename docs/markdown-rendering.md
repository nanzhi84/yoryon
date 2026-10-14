# Markdown 写作与渲染规则

本文记录当前实现，供作者写作和组件维护使用。适用于文章、帖子正文；首页帖子、公开详情和私有全文复用 `MarkdownSurface`，正文是否可见由服务端权限与预览裁剪决定。前端不会为未授权全文生成摘要。

## 文件与普通语法

每篇内容放在包含 `index.md` 的目录，媒体使用目录内相对路径，例如 `media/photo.png`。发布文件以 frontmatter 开头：

```yaml
---
title: 一篇文章
slug: my-article
type: article
visibility: public
description: 标题下方的说明，也用于内容列表。
tags: [writing]
collections: []
---
```

`article` 必须有标题；`post` 标题可空。`description` 是元信息，不是要点卡片。合集必须先创建，再在 `collections` 中引用。CLI 发布命令为 `pnpm cli publish <文章目录>`；连接环境决定发布目标，使用前确认当前数据库、存储和站点配置。

正文支持标题、段落、粗体、斜体、引用、有序与无序列表、嵌套列表、链接、图片、行内代码和围栏代码块。段落之间用空行；中文标点旁的粗体采用 `remark-cjk-friendly` 解析规则。

当前没有启用 GFM：管道表格、任务复选框、删除线和裸网址自动转链接不属于已实现约定。链接请明确写成 `[说明](https://example.com)`。不渲染作者提供的原始 HTML，也没有启用 HTML、数学公式、Mermaid 或通用脚注扩展；不能靠贴 `<figcaption>` 获得图注组件。

付费预览由 frontmatter 的 `preview` 控制：公开内容缺省 `full`，付费内容缺省 `none`；可显式选择 `full`、`none`、`percent` 或 `marker`。`marker` 使用独立的 `<!-- more -->` 注释划分免费与付费部分，缺少标记会拒绝发布；它是发布层识别的边界，不代表允许渲染 HTML。裁剪在 Markdown AST 层完成，具体规则见 [架构中的预览截断](architecture.md#62-预览截断markdown-ast-层)。要点和图注只渲染裁剪后仍可见的内容。

## 可选的本文要点

文章的简介（description）会自动显示为「本文要点」卡片，支持一句话；日期下方不再重复展示简介。简介为空或只有空白时不渲染。若当前有权阅读的正文已有明确的要点块，优先显示正文的要点，不重复简介，也不读取未授权正文来生成要点。

正文也可以在顶层写标题“本文要点”，紧接一个非空段落、有序列表或无序列表：

```markdown
### 本文要点

1. **第一个要点标题**这里写说明。
2. **第二个要点标题**这里写说明，可加 [相关资料](https://example.com)。
```

渲染器将标题与内容包成有名称的 `section`：浅灰底；有序列表使用圆形序号，每条首个粗体标题独立一行。条目数量不限，内容由作者填写，不自动生成。

一句话示例：

```markdown
### 本文要点

以客服分流为主线，解释类型化决策接口与 Agent 接入边界。
```

识别条件：正文顶层 `h2` 到 `h6`（即 `##` 到 `######`），标题去除首尾空白后恰好是“本文要点”，紧随其后接一个非空段落或列表，只包装这个内容块。段落不显示序号，无序列表保留普通项目符号，有序列表使用圆形序号。嵌套在引用或列表里的标题不触发；空列表或仅有标题时，保持普通 Markdown 显示。

这是可选块。简介为空且省略正文要点，就没有卡片和占位；“本文要点”也不是 frontmatter 字段。普通有序列表不套用卡片。列表中其他位置的粗体仍是行内粗体。

## 统一 Caption

图注、代码说明与列表说明使用同一个 `Caption` 组件：无衬线字体、13px、行高 1.55、字重 400、弱化文字颜色；粗体标签为字重 600，保持在同一行。它与正文的衬线字体和字重 650 的粗体不同。

### 推荐写法：明确的粗体标签

使用独立的顶层段落，首个元素是以下标签之一：`**图 N**`、`**代码 N**`、`**列表 N**`、`**卡片组**`。N 为数字，标签与数字之间可有空白；粗体内只放标签，说明写在粗体外。

````markdown
```ts
const title = "示例";
```

**代码 1** 这段代码展示标题的定义。

![一张图片](media/photo.png)

**图 1** 图片来源与内容说明。
````

这种标签段落不要求前一块必须是代码或图片，因此也可用于由普通段落构成的流程说明。普通的 `**重点** 说明` 不会变成 Caption。`**图 1：全部说明**` 也不符合标签约定；请把冒号和说明放到粗体外。

### 图片后的整段斜体

同时支持以下已有图文写法：

```markdown
![一张图片](media/photo.png)

*图 1：这张图片的说明。*
```

必须紧邻前一个含图片的顶层块；整段只有一个斜体元素，且文字以“图 + 数字 + 中文或英文冒号”开头。渲染后使用普通图注字体，不保留斜体。斜体后接普通正文的混合段落不触发。需要粗体标签时使用上面的推荐写法。

独立 Markdown 图注实际输出 `<p class="editorial-caption">`，不会生成脱离 `figure` 的非法 `figcaption`。在手写 React 的合法 `figure` 内可使用 `<Caption as="figcaption">…</Caption>`。当前不会自动把图片、代码和 Caption 包成 `figure`，也不会自动编号。

## 图片、音视频与作品引用

```markdown
![替代文字](media/photo.png)

::audio{src="media/audio.mp3"}

::video{src="media/video.mp4"}

::work{id="目标作品的真实UUID"}
```

音视频与作品引用指令独占一行，并与相邻段落用空行分开。发布阶段登记本地媒体并改写为 `/api/media/<uuid>`；不要手写或保存会过期的签名地址。作品引用用现有作品 UUID，展示目标当前允许的摘要，不嵌入未授权全文。图片的替代文字既描述图片，也用于图片预览按钮；可点击打开，Esc 关闭。

代码块指定语言时，公开服务端正文按已支持语言使用 Shiki 高亮；客户端帖子展开和私有全文不加载服务端 Shiki，保留普通代码。未知语言按普通代码显示。代码块独立横向滚动，正文和长链接在阅读列内换行。

## 当前排印参数

| 内容 | 字体类别 | 字号 / 行高 | 字重 |
| --- | --- | --- | --- |
| 详情标题 | 衬线 | `clamp(25px, 5.2vw, 31px)` / 1.38 | 600 |
| 详情正文 | 衬线 | 桌面 17px / 1.85；≤640px 为 16px / 1.85 | 400 |
| 正文粗体 | 继承正文 | 继承 | 650 |
| 二级标题 | 衬线 | 23px / 1.4；≤640px 为 21px | 600 |
| 三级标题 | 衬线 | 19px / 1.4 | 600 |
| 日期、说明 | 无衬线 | 13px / 1.6 | 400 |
| Caption | 无衬线 | 13px / 1.55 | 400；标签 600 |
| 详情代码块 | 等宽 | 13px / 1.6；≤640px 为 12px | 400 |
| 信息流正文 | 衬线 | 15px / 24px | 400 |

字体使用系统回退栈，不下载 Web Font：

```css
/* 阅读文字 */
"Iowan Old Style", "Iowan Old Style BT", "Palatino Linotype", Palatino,
Georgia, "Songti SC", "Noto Serif CJK SC", "Source Han Serif SC", "SimSun", serif

/* Caption、文章元信息 */
-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue",
"PingFang SC", "Microsoft YaHei", "Noto Sans CJK SC", Arial, sans-serif

/* 详情代码 */
"SF Mono", SFMono-Regular, ui-monospace, Menlo, Monaco, Consolas,
"Liberation Mono", monospace
```

页面背景：浅色 `#ffffff`，深色 `#151514`。要点卡片浅色 `#f3f3f2`、深色 `#1f1e1c`。阅读列最大 660px，标题居中；全站页面、顶部品牌栏和主导航共享最大 660px 内容列（外壳 708px 含左右各 24px 留白），窄屏随视口收缩；品牌控件保持现有风格。不同操作系统可能选中不同的回退字体，这些参数不保证跨平台逐像素相同。

## 渲染边界与维护位置

数据流：作者 Markdown → 发布解析、预览投影与服务端权限裁剪 → `MarkdownSurface` → 搜索文本节点装饰 → 要点卡片与 Caption 样式识别 → React 元素。公开正文和私有全文共用样式识别，装饰只消费当前响应中已允许阅读的内容。

要点与图注识别发生在搜索节点装饰之后，不重写文本和字符位置；维护时不能为了样式拆字或重排节点，否则可能破坏精确搜索定位。

实现入口：

- `apps/web/components/markdown-surface.tsx`：Markdown 与媒体渲染。
- `apps/web/lib/rehype-editorial-summary.ts`：可选要点卡片。
- `apps/web/lib/rehype-caption.ts`、`components/caption.tsx`：Caption 识别与展示。
- `apps/web/components/markdown.tsx`：公开服务端代码高亮。
- `apps/web/app/globals.css`：字体、排印、背景与主题参数。
- `packages/core/src/markdown.ts`、`search-projection.ts`：发布解析与搜索投影。

新增或修改语法时，同时检查发布、预览、私有全文与搜索节点契约；以真实内容在隔离环境验收，按项目 `AGENTS.md` 保存工件，不维护固定测试脚本。

### 段内硬换行与搜索标记

Markdown 的两个行末空格（或反斜杠）表示一次段内换行。渲染管线在搜索节点装饰后隐藏 `<br>` 后由 remark-rehype 生成的首个格式化换行符，避免 `white-space: pre-wrap` 将其再次显示为空行；该字符仍保留在 `textContent` 中，搜索节点 ID 与 UTF-16 偏移保持不变。普通软换行、作者明确留出的空白段和代码块不受此处理影响。

### 短帖原文空行（2026-10-15）

短帖的信息流、详情（包括授权全文）和本地格式整理页使用 `preserveBlankLines`。普通换行保留为下一行；块之间每个空白源行留出一整行正文高度，连续空行累加，文件末尾单个换行不算空白行。列表项与引用内部采用相同源行计数；代码块内部继续保留原始代码空白。文章仍使用原有段落排版。

`rehypePostSpacing` 在搜索节点装饰之后运行，仅调整几何样式及无文字的末尾占位，不改写文本、搜索节点 ID 或正文 Markdown。`.prose-post` 清除默认段距；信息流的正文行高是24px，详情31.45px，窄屏详情29.6px。若修改短帖字号或行高，应同步该样式的 `--post-line-height`。

纯文字短帖发布时保留正文源码（含连续、开头和结尾空行），仅移除 frontmatter 之后约定的一个分隔换行，与本地格式编辑器的正文边界一致。无待改写媒体的 post 不经过 AST 重新序列化；需要媒体地址改写的内容仍使用既有规范化路径。这样格式整理页保存的空行不会在 CLI 发布时被压缩。
