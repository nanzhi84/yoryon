# 独立发布后验收

验收对象：https://yoryon.com，匿名，同一机器。主 agent 报告发布版本 66fb258；本验收从生产实际资源独立核对外部结果。未写生产数据、未创建测试数据。

## PASS

- 首页真实返回的第一个短帖 `note-2026-09-27-1` 已内嵌完整正文（含末句“管理真的是个很困难的事情。”），`collapsed: false`。生产编译 JavaScript 对 public && !collapsed 的展开分支只设本地 open 并 return，位于 fetch 前；Markdown useMemo 保持挂载。说明该短帖展开已不再依赖正文网络请求。这是公开资源确认，不冒充点击耗时实测。
- `/p/freedom-before-wealth` 返回独立文章结构及真实标题、日期、全文。首页该文章 readerLayout 含 12 个段落/标题结构块；详情返回 skeleton，生产 CSS 有 1.2 秒连续横向扫光和 reduced-motion 例外。静态资源验证通过，未据此声称动画已肉眼实测。
- 首页有 data-post-blank-lines 标记，CSS 定义 feed 24px、详情31.45px空行行高。
- `/tools/post-format` 与 `/api/local-post-editor` 都为 404，本地编辑器未公开。

## 网络对比（各3次，中位数，毫秒）

| 路径 | 发布前 TTFB | 发布后 TTFB | 发布前完整响应 | 发布后完整响应 |
|---|---:|---:|---:|---:|
| 短帖详情 API | 322 | 255 | 322 | 255 |
| 文章详情 HTML | 393 | 252 | 433 | 402 |

无人工节流、curl 默认缓存，每条请求独立进程。原始样本及时间戳见 performance-before/http-samples.json、performance-after/http-samples.json。复现：`curl -sS -o /dev/null -w "%{json}" https://yoryon.com/p/freedom-before-wealth`；另一条替换为 `/api/contents/note-2026-09-27-1`，每条连续运行3次。公开资源证据含实际URL、hash与分支片段。

不能将网络指标当作 UI 点击延迟；新展开已绕开这里测量的 API。样本小且连接/边缘缓存不是严格冷缓存，文章完整响应只小幅改善，不宜夸大。

## UNVERIFIED / 限制

子 agent IAB 创建后控制多次30/60秒超时；主 agent 接管实际点击验收并另记 browser-observations.md。本次未独立得到点击→URL、骨架可见、全文可见的稳定浏览器计时；动画可见性、前进后退恢复也未由本子 agent 在生产重新确认。构建、状态码和本报告静态证据不替代这些业务路径。
