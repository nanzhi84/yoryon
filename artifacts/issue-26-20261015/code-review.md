# PR #29 / Issue #26 独立代码与架构审核

- 初始审核版本：`6fda6d54cdf92d57930aeaac82dcee1f72cf6592`；基线 `origin/main`。
- 修复复核：原源码 HEAD `0d4140e000ac0814beb1bdcc2ff7221e1952d06a` 已包含两项 P2 修复；累计schema集成复核 HEAD `9b8ac20d41b02ca1b40b3db7788a7577689687ab` 已 rebase 到 #28 合并后的 `origin/main`。追加复核 HEAD `193290b79c97e60c74e71716c6bc374a956e03a1` 修正未来迁移时间；当前最终源码审核 HEAD `3038fda97569dd5aeff1f95e39c505b2615dc639` 补全章节刷新/直达新流程，既有修复与 P3 架构总览均保留。
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
| 真正文展示才记忆/计时 | PASS | `apps/web/components/content-body.tsx:19` 仅 full 挂 ChapterReading；`private-body.tsx:12` 在实际动态正文模块挂 WorkBodyTracker/ChapterReading；`chapter-reading.tsx:31-51,92-101` 当前 API 成员校验及前台条件，不把预览/加载当有权正文。 |
| 多合集、直达与流程去重 | PASS | `collection-navigation.tsx:10-14` 仅实际选定合集携带 liveFlowId；`chapter-reading.tsx:58-82,93-97` canonical成员成功后复用匹配流程或新建零累计流程，正文和导航共享；`collection-flow.tsx:46-52,67-84` 离链丢弃，目录/章节共享elapsed与一次sent。普通无上下文作品直达不写任意合集位置。 |
| 文件和依赖边界 | PASS | 公开 collections DTO、浏览器可选记忆和统计生命周期各自独立；媒体模块复用于真实的发布/合集两个用例。未发现新增循环或私有正文进入本地持久化；变更手写 TS/TSX 最大494行。 |

上表 PASS 是源码合同判断。OSS/fs 实际字节、故障注入、发布排序、会员权限、localStorage/multi-tab、列表返回、流程事件及 CLI 报表的现场结果以独立业务报告为准。

## 合并阻塞项

上述 2 项修复的源码复核已通过，没有其他源码合并阻塞项。最终合并需包含修复，等待业务 reviewer 的实际复验，不能仅凭本报告或静态检查宣布业务通过。

## 结构观察

- P3 文档漂移（已同步并提交）：原 `docs/architecture.md:361,411-412` 仍称目录裁剪正文、成员内容流、探索包含合集；新 ADR-0016 正确。主 agent 已更新 feed 独立筛选、目录 DTO、成员接口和新页面/导航说明（集成后 `architecture.md:362-370,419-421`），源码复核 PASS。没有具体运行失败，非阻塞。
- 原生多标签页可见性、shared browser Cookie、OSS 私有桶与签名、不可用存储及异常 API 的实际表现不能仅靠读取代码确认。未验证的范围须在业务工件分别说明；本 reviewer 未改变环境或生产数据。

## ADR 一致性与整合要求

| ADR | 状态 | 说明 |
| --- | --- | --- |
| ADR-0003 | PASS | 公开列表/目录候选与权益正文分别 DTO；账号变体 no-store。 |
| ADR-0006 | PASS | 同媒体存储、内容寻址、上传后事务、GC锁和共享引用。 |
| ADR-0007 | PASS | 合集和作品独立 target，原 event_id 重试/去重协议；View与Read是不同生命周期。 |
| ADR-0016 | PASS（修复后） | 首页设置、顺序、更新时间、记忆与流程边界一致；hash和首次可见问题已修。 |

原始两分支的 0014 snapshot.prevId 指向 0012，且未包含 #28 的 analytics_visitors/visitor_id。这是初审时待整合状态，未列为缺陷。#28 合并后已完成下述独立集成复核，没有遗留迁移链问题。

## #28 合并后的独立集成复核

当前审核 HEAD 为 `9b8ac20d41b02ca1b40b3db7788a7577689687ab`，`origin/main` 为 #28 合并提交 `8b447bb7`。按只读要求未重复运行生成器或浏览器；独立读取累计源码和完整 JSON metadata，并核对主 agent 实际命令回执。

| 检查 | 结果 | 证据 |
| --- | --- | --- |
| Journal顺序及迁移完整性 | PASS | `packages/db/drizzle/meta/_journal.json:89-109` 保留 idx12、13、14及三个顺序递增时间；0013和0014 SQL都存在，0013不被覆盖。 |
| Snapshot前继链 | PASS | `0013_snapshot.json:2-3` 前继为0012；`0014_snapshot.json:2-3` 前继精确等于0013.id，不再跳过0013。 |
| 累计metadata完整保留 | PASS | 对0013和0014完整JSON做递归结构比较，除id/prevId之外，唯一差异为新增 `tables/public.collections/columns/is_pinned` 与 `tables/public.contents/columns/show_in_home`；其他表、索引、约束和全局metadata无差异。 |
| 访客schema与索引 | PASS | `0014_snapshot.json:133-312` 的analytics_events和analytics_visitors表与0013完全相等，visitor_id可空、first_seen_at非空、PK与visitor/time索引完整；源码 `schema-analytics.ts:22-37` 一致。 |
| 两项合集字段 | PASS | `0014_snapshot.json:501-507,1390-1396` 保存is_pinned=false/not-null及show_in_home=true/not-null；`packages/db/src/schema.ts:102-103,178` 同样定义，0014 SQL有对应新增与数据保留更新。 |
| re-export和既有访客实现 | PASS | `packages/db/src/schema.ts:292` 保留schema-analytics导出，index仍导出schema；访客API、CLI、Cookie和queue源码相对origin/main无差异，未因automerge遗失。累计schema.ts为467行。 |
| 文档合并 | PASS | `docs/analytics.md:70-93,131-137` 同时保留visitor/账本/隐私及新增合集流程；`docs/architecture.md:218-228,362-370,419-421` 同时包含访客存储与合集新API/导航边界。 |
| 无反向或重复生成DDL | PASS（回执+metadata核对） | 主 agent 的 `integrated-db-generate.txt` 记录 `pnpm --filter @yoryon/db generate` 最终 `No schema changes, nothing to migrate`；当前无0015+迁移文件或未提交schema/meta变更。完整JSON递归比较与源码一致，未发现待补字段/索引或重复DDL。 |
| 静态检查 | PASS（回执） | `integrated-typecheck.txt` 记录全仓 `pnpm -r typecheck` 所有包Done；本 reviewer 运行 `git diff --check` 无错误。 |

集成结论 PASS，无新增源码、schema或metadata合并阻塞项。生成器和typecheck回执只验证相应技术步骤，不增加浏览器业务覆盖，也不代表执行了生产迁移；原生后台和真实OSS限制维持业务报告原结论。

### 追加：未来迁移时间导致后续迁移跳过（主 agent 发现并修复）

复核 HEAD `193290b79c97e60c74e71716c6bc374a956e03a1`。前次仅检查 journal 时间递增不足以排除此问题：原0014.when=`1792022400000` 比实际审核时钟晚约310分钟。若先将0014执行并记入迁移账本，在该未来时间到达之前生成0015，其when可以小于已记录0014，迁移器会静默跳过0015。该风险属于实际迁移器合同，不能仅靠idx递增、snapshot链或No schema changes排除。

已核对当前安装依赖的真实调用链：`packages/db/src/migrate.ts:1-13` 使用node-postgres migrator；`packages/db/node_modules/drizzle-orm/migrator.js:19-23` 将journal.when读为folderMillis；`node-postgres/migrator.js:1-4` 转交PgDialect；`pg-core/dialect.js:56-67` 读取账本created_at最大值，只在 `Number(lastDbMigration.created_at) < migration.folderMillis` 时执行DDL，并将folderMillis写入账本。它不按idx比较，也不因hash或tag不同而强制执行。

修复及独立复核 PASS：`packages/db/drizzle/meta/_journal.json:96-107` 将0014.when改为 `1792003726666`，仍大于0013.when=`1792001860032`。独立只读时钟比较（2026-10-15，Asia/Singapore）显示它已早于当前Date.now()；按照上述实际判定，现在或随后正常生成的新迁移时间会超过0014，不再因原未来时间被跳过。`journal-order.json` 保存修改缘由与递增回执。本次diff仅journal时间及回执，没有修改迁移SQL、snapshot、source schema或业务代码。

只读实际命令：`nl -ba packages/db/node_modules/drizzle-orm/{migrator.js,node-postgres/migrator.js,pg-core/dialect.js}` 核对调用与比较语句；Node读取journal并比较Date.now、0013.when、0014.when和原值。此次没有执行数据库迁移，不将表达式判断视为数据库验收；review26将从fresh隔离数据库执行真实迁移。曾应用原未来时间的临时验收库不自动因修改文件重写账本，本次fresh数据库流程避免复用该旧状态；生产未部署，不存在本次生产账本修复。

### 追加：章节刷新/外部直达的新流程合同与单一上下文所有者

审核 HEAD `3038fda97569dd5aeff1f95e39c505b2615dc639`。此前章节页面只接受已存在内存flow与URL flow的完全匹配，因此带有效合集归属的授权章节刷新/新文档直达会仅统计work，不再有合集Read。依据Issue的“刷新或外部直达建立新实例”以及“无有效合集上下文时只统计作品自身”，旧内存流程不存在不应同时丢弃服务端已验证的合集归属。该合同缺口已由主agent修复。

新实现独立源码复核 PASS：

- `apps/web/components/content-view.tsx:21-50` 的单一ChapterContextProvider包裹正文和导航；`chapter-reading.tsx:16-51,58-88` 仅Provider拥有成员请求。导航和实际授权正文消费同一context/flow，不各自请求或生成流程。
- `chapter-reading.tsx:63-80` 仅canonical成员成功时处理流程。合集ID及URL flow均与holder相符则复用elapsed/sent；否则生成新UUID并显式elapsed=0/sent=false，不从旧URL/localStorage恢复时间或权限。无context的成功结果/404清holder；loading/error不误清正在重查的流程。
- `chapter-reading.tsx:74-82` 创建freshflow后用history.replaceState(null)规范flow参数，随后公开resolved ID。实际安装Next的 `apps/web/node_modules/next/dist/client/components/app-router.js:324-333` 会复制框架内部历史状态并派发URL恢复更新；null不触发内部__NA/_N跳过分支，useSearchParams得到新flow。不新增长度、不请求或缓存授权正文。
- `collection-flow.tsx:43-52` 根观察器只依赖pathname、collection、flow标量；成员响应/本地resolved更新本身不会使旧URL观察effect重新运行。规范URL提交后新ID与holder匹配，不会按旧token丢弃freshflow。导航normalize前仍由loading占位，之后携带共享liveFlowId。
- `chapter-reading.tsx:24-30` 前台恢复先设loading再清context；新context等待期间resolved被清但holder保留，正文计时暂停。合法响应的URL flow仍匹配原holder，因此延续此前有效累计而不新建流程；404、无成员和无合集上下文只保留work自身统计。会员预览仅挂导航，`ChapterReading`仍只出现在实际full正文模块，不能借新流程授予阅读权限。
- effect依赖不包含其自身resolved输出，holder引用稳定；规范URL后flow匹配并停止创建，未发现循环更新或正文/导航双建路径。hash保留且新flow.route仍由实际eligible timer更新，前两项锚点修复不被覆盖。

`integrated-typecheck.txt` 已追加该提交的全仓静态检查成功回执。实际“章节刷新累计归零后产生新Read”“有效合集外部直达”“无/无效上下文只有work”“目录和章节仍在同一流程累计”“前台恢复重查保留累计”须由review26复验SQL及可见结果；本reviewer按只读约束没有操作浏览器，不将上述源码PASS当作新增业务验收。

额外查证并排除一项未启用框架路径：Next源码 `layout-router.js:400-415` 提及Activity保留旧React state，但实际受__NEXT_ROUTER_BF_CACHE控制（`:520-525`）；`bfcache.js:12-13,56` 禁用时只保留当前一个树。项目 `apps/web/next.config.ts:7` 仅设置staleTimes，框架 `server/config-shared.js:198` 的routerBFCache默认为false，当前构建 `.next/required-server-files.json` 同样明确false。因此当前配置没有启用离开的ChapterContextProvider旧React state保留路径，不能把读取到的框架可选实现当作当前运行缺陷。本reviewer曾向主agent提出检查候选，核实开关后已撤回，不据此要求新增就绪层或阻塞合并。

## 可重复审核命令

在本仓执行 `gh issue view 26 --repo nanzhi84/yoryon --json title,body,comments`、`git diff origin/main...HEAD`、`git diff`、`nl -ba <上述文件>`、`rg -n 'preventDefault|onNavigate|router\\.push|router\\.replace|router\\.back' apps/web/components apps/web/app --glob '*.tsx'`，对变更手写 TS/TSX 文件执行 `wc -l`。对迁移 snapshot 读取 JSON 的 id/prevId 和上述新增表/列检查累计关系。没有新增可执行测试、固定断言程序或合成 fixture。
