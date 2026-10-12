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

可重复验证（按顺序执行，禁止并行）：

```sh
pnpm typecheck
pnpm e2e
# pnpm build 的静态生成需要 e2e/helpers/env.ts 的隔离 API/数据库环境
node deploy/verify-cache-production.mjs baseline  # 必须在旧版本执行，保留相同 fixture
# 部署完成后
node deploy/verify-cache-production.mjs after
YORYON_ACCEPTANCE_ARTIFACT_DIR=../artifacts/performance-20261012/after-business/ node deploy/verify-production.mjs https://yoryon.com --browser --oss
node deploy/verify-cli-resources.mjs
node deploy/verify-cache-production.mjs cleanup
pnpm exec tsx deploy/verify-notion-publication.ts
```

baseline/after 会在公开站点短暂创建唯一前缀合成文章，cleanup 只删除其自身 fixture。依赖 SSH 权限、已安装 Playwright Chromium、protected cache config；不保存密钥、Cookie、付费内容或签名 URL。文章来源目录与图片 manifest 放在本地 artifacts，验收脚本只读取不修改 Notion。

缓存工件在 `artifacts/performance-20261012/`；文章工件在 `artifacts/notion-publication-20261012/`。请求日志统计 `serverless` 与 `edge-middleware/static`，结合相同 slug 的 API 正文/门禁调用计数；两类调用不能合并为“零函数调用”。免费计划聚合指标查询会返回 payment_required，不能据此声称平台总体用量下降。

回滚必须先把 web 切回全动态详情，再回滚 API 镜像；新增字段/表留存，恢复新版本时 cache retry。当前门禁每次新请求均检查策略，API 故障 503；旧正文不能作权限收紧的故障回退。已打开/保存副本与最长 900s 既有 OSS 签名 URL 不在可召回范围。
