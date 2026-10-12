中文标点紧贴 `**` 时，发布端把加粗当成文字并转义；排版插件还给行内代码添加了可见反引号。图片只有缩放，签名地址每次变化导致重复阅读重新下载。本变更统一发布、预览与网页的 CJK 强调规则，去掉代码装饰，并为公开图片提供 WebP 压缩和 Vercel 字节缓存。

- PNG/JPEG/WebP 使用四档宽度、质量 72；SVG 保留矢量和内部样式。原图不覆盖，付费全文媒体保留私有鉴权链路。
- 每次图片读取（包括暖 CDN 和条件请求）先经 Edge 检查当前免费 exposure；策略来自单 API 进程的内存快照，发布事件在只读一致事务中刷新。冷填充由 API 再次检查，OSS 签名 URL 不进入 HTML。
- Vercel 字节 TTL 24h；浏览器每次校验，ETag 命中返回 304。转付费、下架、故障不回退旧公开权限。图片冷填充函数使用 sin1。单实例限制与回滚见 ADR-0011。

验证：`pnpm typecheck`、API/CLI 构建、真实 CLI/PG/FS/Next/browser E2E 89/89 通过。覆盖中文标点、转义/代码保真、实际 WebP 像素、宽度白名单、304、公开转付费与下架。真实 OSS/Vercel 候选验收 `deploy/verify-public-image-cache.mjs` 17/17 通过：MISS→HIT、实际 WebP 320×160、同字节、304、暖 URL/旧 ETag 转付费拒绝、重新公开恢复、下架拒绝、合成数据清理。Vercel 检查在提交 1d6c7ce8ebda9119809d02f7a4183cb499effc2f 通过；该提交仅修正验收响应解析，运行时代码与已验收 c52e0a1 相同。三篇实际文章用 `deploy/verify-article-images.mjs` 和现有源码/媒体验收脚本核对；工件脱敏、合成数据串行创建并自动清理。
