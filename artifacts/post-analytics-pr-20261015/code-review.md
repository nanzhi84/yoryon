# 帖子指标 PR 独立审核

结论：**PASS，无阻塞缺陷，可以进入合并流程。**

审核版本：`main...b378f72f75d3967dce11b21446ec170bdc30648d`；实现源码 `62c20cd`，最终 CLI/文档 `bad8f13`。本轮为另一子代理独立只读审核，未改源码、未新建或写生产环境，未运行重复构建，未重新声称现场浏览器验收。

## 范围与判断

- PostAnalytics 仅在 home_feed Provider 中工作，使用真实 IntersectionObserver 的 50% 面积阈值；performance.now 计累计前台 5 秒，滚出和 visibilitychange 清定时器并累加已过时长，恢复使用剩余时长。卸载释放 observer、listener、timer。
- 成功主动展开调用同一 read 回调；失败或 aborted 请求不调用，自动恢复 open 不调用。完成标记与列表实例＋帖子 ID 的 trackOnce 同时防重复；收起重开和自然计时不会双计。
- 帖子日期与评论入口关闭 Click；帖子详情 WorkDetailProvider disabled，不生成作品 View/Read；文章完整正文仍沿用原有 10 秒 tracker。独立的 ChapterReading 未受 WorkDetailContext 禁用影响。
- API 按数据库真实 published 内容类型校验，post 仅接受 home_feed impression/read；旧帖 click/view/read(NULL) 拒收。文章和合集 read 只接受 NULL。未新增私有正文读取、身份字段、互动事件、DDL 或权限旁路。
- CLI 的帖子过滤在聚合 SQL 生效，旧帖详情指标不混入；帖子 clicks/views/ctr 显示 N/A，阅读率使用 impressions，click/view/ctr 排行剔除帖子。删除作品单列未知类型而不猜测。
- DNT/GPC 检查、队列脱敏、event_id 幂等及一次重试仍沿用既有采集核心；计时和展开回调都通过 analyticsDisabled，失败不阻塞内容展示。

## 验收证据复核

阅读 `artifacts/post-analytics-20261015/independent-acceptance.md` 及 API、CLI、SQL、即时展开计时回执。既有独立验收在 production 构建产物、隔离 PostgreSQL 和 IAB 中覆盖不足 5 秒、滚出累计、隐藏暂停恢复、展开立即记读、失败不立即记读、去重、非首页不扩采、文章 10 秒及旧事件隔离。即时展开 534.9ms 后隐藏，read=1/impression=0，能独立排除 5 秒自然 timer 路径。

本轮实际执行 Python hashlib，冻结 evidence-manifest 的 **26 份文件**字节长度及 SHA256 全部一致，runtime-manifest 的当前构建产物与源文件哈希全部一致；这是证据完整性检查，不代替业务验收。

`git diff --check main...HEAD` 报告原始 build.log、CLI 和 SQL 回执末尾空白，退出 2；源码没有报告空白问题。保留这些原始回执，不为格式清洗改写冻结证据。

## 仍保留的边界

- 原生后台/隐私设置、其他浏览器引擎、真实 OSS 与生产运行：**UNVERIFIED**。已有 visibility/DNT/GPC 结果为明确的 WebAPI 模拟。
- 高于视口两倍的卡片无法达到严格 50% 面积阈值，主动展开仍可记读；快速展开允许 read 早于 impression，阅读率可能超过 100%。已在 ADR 和验收报告明示，符合本次确认口径，无需伪造曝光或另加展开指标。
- 同列表正常滚动保留累计；整页刷新产生新实例。没有引入跨任意卸载的永久去重。
- 生产部署约束由既有 apps/web/vercel.json 的 main=false 保护；最终合并者仍需核对实际生产部署未变化。本轮未执行部署。

## 最终配置复核

`c7b291a` 仅追加本报告与 `apps/web/vercel.json` 的当前分支禁用项，业务源码未变。本轮使用 Python json.loads 实际解析配置成功，确认 `git.deploymentEnabled.main=false` 和 `git.deploymentEnabled["codex/post-feed-analytics"]=false` 同时存在；既有其他分支禁用项保留，无新增全局启用规则。**PASS**，本分支推送及 main 合并的 Git 自动部署均明确禁用。无需重复未变化的业务验收；实际生产最新部署仍由主 agent 在交付时核对。
