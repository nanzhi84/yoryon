# PR #29 / Issue #26 独立代码与架构审核

- 初始审核版本：`6fda6d54cdf92d57930aeaac82dcee1f72cf6592`；基线 `origin/main`。
- 修复复核：源码 HEAD `0d4140e000ac0814beb1bdcc2ff7221e1952d06a` 已包含两项 P2 修复；主 agent 已在工作区同步 P3 架构总览，待最终提交。
- 日期：2026-10-15（Asia/Singapore）。只读实现、只写本报告；未操作任何浏览器、推送或合并。
- 风险：初审 MEDIUM，修复后 LOW。发现 2 项 P2，主 agent 修复后源码复核 PASS；当前未发现其他合并阻塞缺陷。真实用户路径由另一名独立业务 reviewer 执行，不以本报告代替 E2E。
- 使用 `architecture-review` 技能；读完整 Issue、根 AGENTS、相关 ADR、完整变更与主要上下文。无 `.agent-context`，按现有架构与 ADR 识别边界。host rendering: not available。

## 原始发现与修复复核

### [P2] 同页锚点及 hash 历史永久暂停合集阅读计时

初始证据：`apps/web/components/collection-flow.tsx:15-24` 用完整 href 差异认定离页，并在所有 popstate 时无条件置 navigating=true；`collection-flow.tsx:59-80` 只有 timer effect 重新建立才清除此标志，且 pathname/search 未变化时没有重建路径。`apps/web/components/markdown-surface.tsx:76-78` 确实把 Markdown 的 `#anchor` 链接渲染为原生锚点，因此是现有用户路径。

失败场景：从目录进入有权限的章节，在阈值前点击正文同页锚点；后续正文前台停留不再计入合集 Read。只修 click 仍不足：随后在 hash 历史中后退/前进触发 popstate，仍会使同一流程永久暂停。页面与章节没有离开，违反连续阅读前台累计合同。

主 agent 修复及源码复核 PASS：当前 `collection-flow.tsx:19-25` 的点击仅比较 origin/pathname/search；popstate 比较当前路由和已提交的 flow.route；`collection-flow.tsx:67-69` 在 eligible timer 开始时记录 pathname+search。同页 hash 和 hash traversal 不再标记离页，真正跨路由仍暂停加载期间计时。没有发现现有章节入口主动取消 Link 导航的路径；不为假设取消路径要求额外通用 hook。

现场复验要求：使用真实章节 Markdown 锚点，在未达 10 秒前点击，再做浏览器历史后退/前进并继续阅读，核对隔离 SQL 的一个流程一个合集 Read。执行与结果由业务 reviewer 留存，本 reviewer 未操作浏览器。

### [P2] 后台未展示详情在挂载时提前产生 View

初始证据：`apps/web/components/analytics.tsx:153-156` 的 DetailTracker 挂载即 trackOnce(view)，未检查可见性；`apps/web/components/collection-reader.tsx:64` 用它采集合集详情 View。后台打开详情但从未实际前台展示时也会入队 View，与 Issue 的真实展示合同不符。

主 agent 修复及源码复核 PASS：当前 `analytics.tsx:153-163` 把 View 单独放在只对 visible 状态采集的 effect 中，并监听首次 visibilitychange；仍使用稳定 pageViewId 的 trackOnce，前台重复显隐不重复 View。Read 独立 effect 保持阈值累计及正文共享 progress（`analytics.tsx:165-205`）。动态会员正文迟到后沿用作品 View 实例，不额外增加 View。

native 后台标签页首次未展示→首次前台展示的真实验证为 UNVERIFIED：主 agent 表明当前内置 IAB 各页 visibilityState 常为 visible，而 Chrome 桌面不可用，不能以 IAB 的正向显示冒充 native 后台验证。源码分支已复核；业务报告须保留该限制。

## 其他检查与证据

数据流为 CLI 发布/合集资料修改 → OSS 或现有 fs 后端媒体准备 → 单事务章节/封面/更新时间与缓存事件 → 公开合集介绍及已发布目录 DTO → API 校验当前成员关系与独立正文权益 → 浏览器本地定位、上下篇导航和流程累计 → 原 analytics ingest/CLI。localStorage 与 flow 都不参与授权。

| 检查 | 源码结论 | 证据 |
| --- | --- | --- |
| 首页独立设置与迁移存量 | PASS | `packages/core/src/publish.ts:186-188,206-228` 显式 frontmatter 优先，其次已有设置，首次按是否属合集决定默认；`0014_collection_reading.sql:1-6` 按旧 public-only feed 初始化，不因已在合集内隐藏免费旧作品。 |
| 章节顺序与并发发布 | PASS | `publish.ts:259-288` 先按稳定合集 ID 加行锁，保留已存在关系，新增用末尾+1；`apps/cli/src/commands/collection.ts:105-129` 同一行锁和确定顺序；所有 CLI 写路由共用现有 publish/GC advisory lock。 |
| 多合集更新时间与事务缓存 | PASS | `publish.ts:267-289` 同时更新旧/新合集；`apps/cli/src/cache.ts:24-32` 撤回/删除更新原合集；资料/排序和有界90章事件切分在同事务（`collection.ts:10-16,34-46,129-132`）。 |
| 封面上传失败与共享引用 | PASS | `packages/core/src/collection-cover.ts:12-31` 全程持媒体锁，先上传再单事务换关联，不提前删除旧媒体；`media-upload.ts:18-45` 使用实际哈希字节、现有存储、3次有界重试、oss_key 去重；`packages/core/src/gc.ts:68-74` 复核章节/作品封面/合集封面/头像引用。 |
| 封面公开、会员媒体仍受限 | PASS | `packages/core/src/media-access.ts:21-31,33-60` 合集封面公开是作者显式关联，其他媒体继续 exposure/权益判断；`apps/api/src/routes/media.ts:28-44` 权益命中 private,no-store，只签短期 URL。 |
| 目录/导航协议与发布过滤 | PASS | `apps/api/src/routes/collections.ts:34-64` 目录只给公开元数据及个体权益标识，不返回正文；成员接口对当前 published+collection 关系重查，不可信 URL 只作候选。BFF 白名单新增精确 chapters 路径。 |
| 免费/会员及缓存分线 | PASS | `collections.ts:36,43-45` 权益目录 private,no-store；public列表和成员DTO不读账号；正文仍用 `loadContentDetail` 和统一 canAccess；首页 paid条目经过现有 publicPreview 派生和隐藏媒体过滤。 |
| 本地定位不变成授权 | PASS | `apps/web/lib/collection-memory.ts:8-27` 只保存 version/chapterId/time，用当前已发布 ID 集合验证并清除失效；解析、配额、存储异常均降级；没有消费存储 URL、正文或权限。 |
| 真正文展示才记忆/计时 | PASS | `apps/web/components/content-body.tsx:19` 仅 full 挂 ChapterReading；`private-body.tsx:12` 在实际动态正文模块挂 WorkBodyTracker/ChapterReading；`chapter-reading.tsx:31-51,55-64` 当前 API 成员校验及前台条件，不把预览/加载当有权正文。 |
| 多合集、直达与流程去重 | PASS | `collection-navigation.tsx:10-14` 仅实际选定合集携带 liveFlowId；`chapter-reading.tsx:58-60` flow ID 和 canonical collection ID 同时相符才计时；`collection-flow.tsx:46-52,67-84` 离链丢弃，目录/章节共享 elapsed 与一次 sent。普通无上下文作品直达不写任意合集位置。 |
| 文件和依赖边界 | PASS | 公开 collections DTO、浏览器可选记忆和统计生命周期各自独立；媒体模块复用于真实的发布/合集两个用例。未发现新增循环或私有正文进入本地持久化；变更手写 TS/TSX 最大494行。 |

上表 PASS 是源码合同判断。OSS/fs 实际字节、故障注入、发布排序、会员权限、localStorage/multi-tab、列表返回、流程事件及 CLI 报表的现场结果以独立业务报告为准。

## 合并阻塞项

上述 2 项修复的源码复核已通过，没有其他源码合并阻塞项。最终合并需包含修复，等待业务 reviewer 的实际复验，不能仅凭本报告或静态检查宣布业务通过。

## 结构观察

- P3 文档漂移（已同步）：原 `docs/architecture.md:361,411-412` 仍称目录裁剪正文、成员内容流、探索包含合集；新 ADR-0016 正确。主 agent 已在工作区更新 feed 独立筛选、目录 DTO、成员接口和新页面/导航说明（当前 `architecture.md:354-362,411-413`），源码复核 PASS，待最终提交。没有具体运行失败，非阻塞。
- 原生多标签页可见性、shared browser Cookie、OSS 私有桶与签名、不可用存储及异常 API 的实际表现不能仅靠读取代码确认。未验证的范围须在业务工件分别说明；本 reviewer 未改变环境或生产数据。

## ADR 一致性与整合要求

| ADR | 状态 | 说明 |
| --- | --- | --- |
| ADR-0003 | PASS | 公开列表/目录候选与权益正文分别 DTO；账号变体 no-store。 |
| ADR-0006 | PASS | 同媒体存储、内容寻址、上传后事务、GC锁和共享引用。 |
| ADR-0007 | PASS | 合集和作品独立 target，原 event_id 重试/去重协议；View与Read是不同生命周期。 |
| ADR-0016 | PASS（修复后） | 首页设置、顺序、更新时间、记忆与流程边界一致；hash和首次可见问题已修。 |

#28 / 0013 先合并，#29 随后 rebase。此次确认原始 0014 snapshot.prevId 为 0012，且不含 #28 的 analytics_visitors/visitor_id；这是两分支待整合状态，当前不列缺陷。最终 journal 必须13→14、0014 prevId 必须接0013、0014累计两份 schema；否则下一次 db:generate 可能再次产生已存在字段。整合后的 schema/migration 核对由主 agent 完成。

## 可重复审核命令

在本仓执行 `gh issue view 26 --repo nanzhi84/yoryon --json title,body,comments`、`git diff origin/main...HEAD`、`git diff`、`nl -ba <上述文件>`、`rg -n 'preventDefault|onNavigate|router\\.push|router\\.replace|router\\.back' apps/web/components apps/web/app --glob '*.tsx'`，对变更手写 TS/TSX 文件执行 `wc -l`。对迁移 snapshot 读取 JSON 的 id/prevId 和上述新增表/列检查累计关系。没有新增可执行测试、固定断言程序或合成 fixture。
