# 发布缓存与生产验收

ADR-0003/0010 定义公开正文、私有权益与撤销边界。当前 API 单实例，不得在无共享强一致门禁时扩容。

部署顺序：备份 `.env`/受保护配置；构建并上传不可变镜像；迁移 `0003`、`0004`；给 API `cache_events` SELECT/UPDATE、CLI SELECT/INSERT/UPDATE/DELETE；重建 API，确认 health。`node deploy/configure-cache.mjs` 同步独立签名密钥，前端 Production 24h TTL；密钥只在受保护文件和 Vercel sensitive 环境。

安装 CLI 包装入口后，所有生产 CLI 操作统一执行：

```sh
sudo install -m 0755 deploy/blog-production.sh /opt/yoryon/blog
sudo /opt/yoryon/blog publish /posts/<slug>
sudo /opt/yoryon/blog cache status
sudo /opt/yoryon/blog cache retry
```

1GB 主机须在启动容器前取得宿主机 singleton 锁。CLI 容器限制 256MB、0.5 CPU、64 PID；等待最多 120s，固定容器名提供第二道互斥。DB 发布/GC 锁仍保留跨主机事务互斥。禁止绕过入口并行运行验收/发布容器；不同 fixture 仍共享同一主机资源与 outbox，验收必须串行。状态命令也通过包装入口。

前端：核对 `.vercel/project.json` 的 team/project/root，`vercel deploy --prod --skip-domain --meta githubCommitSha=<full SHA>`；候选部署真实 GET 返回正确正文、重复读取 HIT、缺失 slug 404 后才 promote。`.vercelignore` 排除本地来源、工件、环境和构建输出。Preview 只读取公开 API；使用独立非生产 BFF secret、不可匹配的 Origin allowlist，禁止写入，不含数据库/缓存管理凭据。

验收由独立子 agent 按影响范围现场执行，生产 CLI 操作必须串行。核对真实公开文章与缓存回执，涉及权益时覆盖匿名和授权结果、撤销后的访问边界。生产写入与邮件发送须具备用户授权，验收工件脱敏；不维护合成 fixture 或固定断言脚本。文章来源及图片 manifest 只读核对，不修改 Notion。

缓存工件在 `artifacts/performance-20261012/`；文章工件在 `artifacts/notion-publication-20261012/`。请求日志统计 `serverless` 与 `edge-middleware/static`，结合相同 slug 的 API 正文/门禁调用计数；两类调用不能合并为“零函数调用”。免费计划聚合指标查询会返回 payment_required，不能据此声称平台总体用量下降。

回滚必须先把 web 切回全动态详情，再回滚 API 镜像；新增字段/表留存，恢复新版本时 cache retry。当前门禁每次新请求均检查策略，API 故障 503；旧正文不能作权限收紧的故障回退。已打开/保存副本与最长 900s 既有 OSS 签名 URL 不在可召回范围。

## 公开图片字节缓存（ADR-0011）

`/api/images/v2/<mediaId>/<320|640|960|1280|original>` 的 Edge 门禁读取当前免费 exposure，匿名冷请求通过 API 获取私有 OSS 变体，不暴露签名 URL。PNG/JPEG/WebP 使用质量 72 的 WebP，SVG 保留矢量；GIF 由 API 的 sharp 转为保留全部帧、时序与循环的 WebP。合集列表和详情也使用该响应式分发。图片填充函数在 sin1。缓存规则变更须增加路径版本，宽度/查询参数不得任意扩展。

GIF 原文件保留在存储中，OSS 格式转换会丢失动画，因此只在 API 冷回源或授权媒体请求中处理。输入最多 20MiB、总像素 1600 万、500 帧；单进程同时处理一个 GIF，最多等待四个请求，等待和取流共享 12 秒截止时间，原生转码最长 5 秒。超限、损坏、取消与过载返回 no-store 错误，不降级静态图。会员 GIF 复用同一转码器并保持 private/no-store。

循环格式边界：GIF 的最大有限播放次数是 65536，WebP 的字段只能表示到 65535；这一极值收敛到 65535 次，避免默认编码溢出变为无限循环。无限循环和其余有限次数按原语义输出。

发布先升级 API，再升级 Web。公开 URL v2 隔离旧缓存，源站 ETag 保留 image-v1 前缀以兼容滚动发布期间上一版 Web 的解析器；前缀不等于缓存路径版本。旧内部 v1 路径在新 Web 直接拒绝。回滚须配套恢复先前 API 镜像与 Web deployment，原图和数据库无需变更。

Vercel 字节 TTL 86400 秒；浏览器每次校验，合法 ETag 返回 304。转付费或下架后的新请求（含旧 ETag）拒绝，暖 CDN 字节不得旁路门禁。原图/付费媒体继续通过 `/api/media/` 私有鉴权链路；浏览器已取得的副本不在可召回范围。


后续缓存与发布验收由独立子 agent 按根目录 `AGENTS.md` 现场执行，记录匿名/授权缓存隔离、撤权、图片实际字节与最终浏览器结果；历史工件不作为当前测试入口。
