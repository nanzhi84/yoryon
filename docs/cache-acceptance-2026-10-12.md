# Issue #5 / #6 验收，2026-10-12

实现 API/CLI 镜像源为 `8390932763146fe2a23b6dec07e408c4ab374576`；实际 Vercel Production 候选验证后提升为 `dpl_2oWmXAMwuG7RvqSPxkTqKGjb6yiB`，源 `ea26f985161e70b54dd291669dcaabc0cccb932c`。后续提交仅部署资源隔离、工件排除、诊断及验收脚本/E2E，API/web/core 运行时代码未变。main 合并后的 Vercel 部署须另行核对最终 SHA。

| 环境与合同 | 结果与边界 |
| --- | --- |
| 隔离 PG54329、API4101、next start3100、Mailpit、FS、TTL86400 | `pnpm e2e` 85/85 PASS；最终新测试清理计时器后，相关真实 worker 测试单独再跑 1/1 PASS；`pnpm typecheck`、隔离 API 环境 `pnpm build` PASS |
| 同事务 outbox、旧/新关联、404/标签重建、恢复与分页 | 本地真实 CLI/DB/浏览器 PASS；提交后终止真实 worker、并发 CLI 修改、重复/乱序旧事件、撤销后重放 PASS；实际隔离 API SIGSTOP/恢复、503 不返回旧全文 PASS。没有对生产实例施加停机故障 |
| 生产缓存/公开转付费/下线/旧 revision/RSC/别名 | `verify-cache-production.mjs after` 22/22 PASS；同一合成文章修改提交、失效及真实页面验证 10.3s；根域/www 不泄漏旧正文，重新发布可读 |
| 生产登录/兑换/权益/浏览器/OSS/清理 | `verify-production.mjs https://yoryon.com --browser --oss` 49/49 PASS；新 Chromium 桌面与移动 viewport；账号、文章、合成媒体清理 PASS。SMTP 投递 UNVERIFIED，当前工作不发送真实邮件 |
| 生产主机互斥与资源限额 | 两个同时发起的只读状态命令成功；31 个采样最大 CLI 容器数 1；256MB/0.5CPU/64PID 生效，API 健康。历史故障与归因边界见 incident-2026-10-12.md |
| 真实 OSS 派生图 | 9/9 PASS：960x480 合成 PNG 经 OSS 返回 320x160、640x320；非法宽度 400，转付费后匿名派生入口 403，合成数据清理 |
| 相同文章 5 次暖读 | 原版本正文 API +5；新版本正文 API +0、门禁 API +5；正文缓存没有消除权限门禁或 analytics/媒体调用 |
| Vercel 免费请求日志取证 | 原版本抽样 10 条均 serverless/MISS；新版本 19 条包含 11 条 edge-middleware/HIT、3 MISS、2 REVALIDATED、2 无 cache 字段及 1 serverless/MISS（生成）。可核查该样本的 SSR 路径变化，不能当成全站总调用数 |
| 路由缓存 | `/`、`/c`、`/tags/cacheproof` 重复真实 GET 为 HIT；页面含 catalog version；sitemap 用轻量全量 API 快照，无全文查询/分页逐页取数 |
| Lighthouse 13.5 移动默认档，独立无代理 Chrome，清理浏览器状态 | 首页 99 → 99；同一详情 99 → 99，LCP 1830ms → 1751ms、CLS 0。单样本，不代表总体分布 |

Vercel 聚合 Function invocations / ISR writes 查询需要付费 Observability Plus；返回 payment_required，未升级套餐，不声称已经量化平台总量下降。免费日志与 API 调用计数提供有范围的对照证据。

重现命令、凭据前提、数据隔离、清理和回滚见 `deploy/README.cache.md`。本地脱敏工件在 `artifacts/performance-20261012/`：baseline/after-cache-proof.json、after-business/production-bff-acceptance.json、oss-derivative-proof.json、recovery/cli-queue-proof.json、catalog-route-cache.json、baseline/after-vercel-requests.jsonl、baseline/after-lighthouse-{home,detail}.json、local/full-e2e85/index.html。故障和脚本旧断言导致的失败记录单独保留在 attempts/，不覆盖为成功。

权限边界：单 API 实例内存门禁，扩容前必须引入共享强一致门禁；每次新网络读取先检查当前 UUID。API 不可用返回 503，不回退旧公开全文。已下载、已打开副本不可远程召回，既有 OSS 签名 URL 最多仍可用 900s。没有扩大免费媒体共享缓存范围。
