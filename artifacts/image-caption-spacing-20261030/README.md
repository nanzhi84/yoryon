# 图片图注样式调整

业务目标：图片后的编号图注使用较小灰色文字并紧贴图片。复用既有 editorial-caption 排版（13px，行高1.55，随阅读主题切换灰色），图片到图注6px。

边界：仅将紧随图片独占段落、以“图 + 编号 + 空格/冒号”开头的段落识别为图片图注；普通正文提到图片不会被识别。保留既有加粗标签图注识别。文字、搜索节点、图片地址和放大交互不改。无数据库或内容修改。

环境：Node/pnpm 按仓库配置，仓库公开静态快照，无API或生产凭据、无测试业务数据。

复现命令：
```sh
pnpm typecheck
pnpm build
pnpm preview --port 3103
```
访问 /p/vibe-coder-computer-networks/，查看五图注，切换深浅主题及375px视口，打开图片预览并搜索正文。日志见 typecheck.log、build.log；独立验收见 acceptance.md。不新增固定测试程序。

回滚可撤销本次两文件样式/识别变更后构建部署。

现场浏览器：内置 IAB 不可用；主 agent 使用隔离 headless Chromium（Playwright 包来自 Codex bundled runtime，Chromium 1248）执行临时 node stdin 命令，无用户浏览器操作。对 1280px浅色、375px浅色、1280px深色分别打开真实静态页面，逐图滚入视口、检查加载后读取 computed style 和 boundingClientRect，截图，并点击图片与 Escape 关闭。实测15组图注均13px/6px，无横向溢出；颜色详见 browser-result.json。复现时对每个 .editorial-caption 读取 getComputedStyle(el).fontSize/color，间距计算为 el.getBoundingClientRect().top - el.previousElementSibling.querySelector('img').getBoundingClientRect().bottom。截图 desktop.png/mobile.png/dark.png。

搜索补验通过：实际在 /search/?q=IP、端口与 DNS 知识结构 点击文章结果，等待阅读页导航和 CSS.highlights 的 search-hit，图注文本定位高亮仍正确（search.json）。阅读页使用 CSS Highlight API，不生成 mark 元素；初次探查错误等待 mark 已修正，不是页面故障。
