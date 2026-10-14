# 按文章结构显示骨架

环境：本机隔离 PostgreSQL `yoryon_reading_preview_20261014`，API 4117，Web 3117。版本与构建目录见 environment.json；基于当前未提交工作区。保留原有 25 篇公开文章副本与本地换行修正，无生产数据修改。

## 实现

- feed/paid-feed/tag feed 提前派生匿名可见正文几何，协议 pin-v4。
- 标题、日期直接显示；按文章顺序显示不同长度的段落、标题、列表、引用、代码与媒体占位；每条占位保留扫光。
- 导航 hint 仅 React Context 内一份，按 slug 匹配，退出文章路径清除；不缓存正文或权限，不增加点击请求。
- 结构最多 12 块、每块 12 个长度，显示每段最多 8 行；手机宽度重新估算换行。媒体比例通用，属于结构近似。
- 直接访问、新标签或非信息流入口无结构时回退通用骨架。

## 命令与前提

需现有隔离 API 配置和数据库；私有 preview.env 路径在 environment.json，不复制凭据。

静态检查：`pnpm typecheck`，PASS，见 typecheck.log。
构建：加载私有环境文件后，在 environment.json 的 buildWorkspace 执行 `pnpm build`，PASS，见 build.log。
构建目录与运行目录隔离，构建通过才切换端口 3117。

复现：打开 localhost:3117 首页，等待可视区域预取完成；仅在验收标签启用网络延迟，再点击文章标题；观察独立文章页结构骨架和扫光，正文就绪后自动替换。返回首页选择另一篇，比较结构；手机视口确认无横向溢出。还原网络模拟并关闭验收标签。

独立真实路径结果与证据见 acceptance/。
