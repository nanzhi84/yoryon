# 文章页骨架交互

目标：点击首页文章标题/封面，立即进入独立文章页，页面内骨架过渡到正文；首页不显示“正在打开…”。

数据流：Link automatic partial prefetch → loading.tsx无内容阅读页骨架 → 点击进入/p → connection动态请求 → no-store current revision API（3s超时） → revision-keyed public Data Cache → ContentDocument。付费全文仍走PrivateReader私有读取。骨架不存正文，dynamic staleTime0；static300只复用部分预取的壳，禁止文章完整预取。

失败方式与边界（编码时确认）：prefetch意外包含正文；metadata阻塞骨架；冷链接尚未预取；公开改付费后旧RouterCache正文复用；policy超时/不可达；404流式状态；返回中断和移动/键盘入口；动态HTML/RSC必须private/no-store。独立验收使用真实隔离API和内容，现场命令及截图，不新增固定测试脚本。

环境沿用用户本地隔离预览，生产不改；关闭此前主标签1.5s网络延迟。为了验证加载边界，可在验收专用标签临时限速，结束撤销。
