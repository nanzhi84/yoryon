# 独立验收

环境：2026-10-30，worktree network-article-sync/yoryon。基于 pnpm build 产物 apps/web/out；预览 http://127.0.0.1:3103/p/vibe-coder-computer-networks/。

PASS：HTMLParser 读取生成 HTML，五张图片独占段均有 captioned-image，紧随的五条说明均有 editorial-caption，全文保留。仅这五段被标记为图注，普通正文未误分类。数据见 independent-html.json。
PASS（源码审查）：编号说明识别要求上一元素为无可见文字且含图片的 p；strong 编号标签路径保留；CSS 声明图注13px/灰色/6px margin，图片及父段下边距归零。
UNVERIFIED：实际 computed style、几何6px、375px、深色、图片放大及搜索定位。当前 CUA 浏览器 inventory 为空，IAB unavailable；原生 Chrome 新标签操作被用户更改应用中断，重读后仍为用户 Gemini 页面，为避免抢焦点未继续。工具要求 UI 仅通过 CUA，未绕过工具使用 shell Playwright。
UNVERIFIED：旧 em/strong 图注真实路径；当前快照未找到此类内容。

复现：pnpm build，pnpm preview --port 3103；浏览器打开上述文章，测五图注字体/颜色/间距，切375px及深色，点图放大并Esc返回，搜索图注文字后进入定位。未创建测试数据或固定断言脚本。

## 补充：独立复核主 agent 渲染证据

主 agent 另行执行隔离 headless Chromium，提供 browser-result.json 与 desktop.png / mobile.png / dark.png。本子 agent 未执行该浏览器命令，已独立读取结果并目视三张截图。

PASS（证据复核）：桌面、375px 与深色截图中的第一图注均明显小于正文，呈灰色且与图片紧邻，长说明自然换行，无裁字；正文保持原字号和排版。深色中灰色说明可读，白底SVG正常。JSON 对全部五图在三模式记录 font=13px、gap=6、loaded=true；浅色 rgb(107,104,102)，深色 rgb(156,151,142)，overflow=false；与截图可见效果一致，支持图注视觉要求达标。JSON 同时记录各模式图片预览打开及 Esc 关闭 PASS。

范围限制：截图目视覆盖图1，其余图注尺寸/颜色/间距基于主 agent DOM测量数据复核；搜索定位结果未包含于该JSON，继续 UNVERIFIED；旧图注实际内容、真机及其他浏览器未覆盖。此次视觉效果无阻断发现。
