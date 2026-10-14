# Issue #26 独立验收与代码审查

独立结论：**可合并**。已发现的实现问题完成修复，最终组合版本通过本次可执行的真实业务与故障路径；原生后台与实际 OSS 明确未验证。此文件仅记录现场验收，没有固定测试程序，也不授权生产部署。

需求来源：[Issue #26](https://github.com/nanzhi84/yoryon/issues/26)，完整正文见 `issue.json`。

## 隔离前提

- 数据库：阶段库 `yoryon_issue26_20261015`、存量迁移库 `yoryon_issue26_legacy_20261015`、最终组合空库 `yoryon_issue26_combined_20261015`；通过现有本地容器 `deploy-postgres-1`（127.0.0.1:54320）新建。没有读取生产配置、复制真实用户或写生产业务数据。
- 配置：`/tmp/yoryon-issue26-HJGFGZ/acceptance.env`，0600；只包含独立本地配置与临时密钥，不纳入工件。
- 媒体后端：现有 fs，独立根目录 `/tmp/yoryon-issue26-HJGFGZ/storage`。实际 OSS 私有桶与生产签名链路本次未验证。
- API：4026；Web：3026；Mailpit：11025/18025，仅捕获本地 `example.test` 地址。本次不向真实用户发信。
- 源码：`/Users/yoryon/Projects/yoryon`；分支 `codex/issue-26-collections`。开发阶段审查 SHA `32aeb3b81265ebebb44da0d0107f4a6a2c00ff9d`；#28 合并后修正 journal 的组合迁移 SHA `193290b79c97e60c74e71716c6bc374a956e03a1`；最终业务源码、正式构建与补验 SHA **`3038fda97569dd5aeff1f95e39c505b2615dc639`**。运行文件哈希见 runtime-manifest.json。

## 现场用户路径与失败方式

1. 真实 CLI 创建合集，发布独立文章／短帖、合集内章节；查询首页及目录，显式开关首页展示并重新发布，核对数据与最终页面。确认关联、权限、首页展示独立。
2. CLI 修改合集资料、置顶／取消置顶、编辑旧章、新增章与多合集成员；核对更新时间、排序、缓存事件及章节序号。选择同时发布／排序路径观察共享发布锁下的结果。
3. 真实封面上传、更换、无封面、共享正文媒体；从匿名页面取得媒体、核对实际字节。触发上传／关联失败并核对原关联；GC dry-run 与 apply 后核对仍被引用的媒体。OSS 桶直链限制列为 UNVERIFIED，不能由 fs 成功推导。
4. 浏览器桌面与移动端：导航／探索折叠标签、卡片、详情、唯一阅读按钮、空态、正倒序目录、首尾上下章、返回合集，以及单篇互动保留。
5. 本地续读：首次、前台正文展示、刷新、重读旧章、新章／编辑不移动位置、损坏／禁用存储、撤回／删除章、多标签页、多合集与直接作品入口。会员锁定预览不能改写阅读位置；目录点击或预取不能替代真正阅读。
6. 权限：匿名／普通用户／有效与过期权益、会员正文和媒体，直接 API 请求核对 no-store。数据与会话只保存在 /tmp，不进入报告。
7. 浏览器→API→SQL→CLI 流量：可见曝光／主动标题与封面点击、详情 View；跨目录与章节前台计时、后台暂停、锁定预览、返回与上下章去重、独立流程隔离、多合集与无效上下文。用真实操作再核对事件类型／目标与报表，不以 API 接收成功代替行为成立。
8. 失败隔离／隐私：重试 event_id 幂等、有界失败、DNT/GPC、零分母 N/A，未解锁响应与工件无敏感正文／凭证／原始访客标识。

## 已执行回执

```sh
gh issue view 26 --repo nanzhi84/yoryon --json title,body,url > artifacts/issue-26-20261015/issue.json
docker exec deploy-postgres-1 psql -U postgres -d postgres -Atc "select datname from pg_database where datname='yoryon_issue26_20261015'"
docker exec deploy-postgres-1 createdb -U postgres yoryon_issue26_20261015
```

数据库创建前查询为空，创建成功；端口 4026/3026 准备时没有监听者。临时配置由 Node crypto 生成随机密钥并设 0600，无密钥输出。

## 已处理的发现

- **FAIL → PASS**：旧迁移将存量 paid 作品设为首页可见。已初始化 public true / paid false，独立与合集的四种旧已发布作品均保留原首页可见状态，既有章节顺序保留。见 `populated-migration.txt`。
- **FAIL → PASS**：375px 目录隐藏日期。已修为所有断点可见；320px 每个日期宽度非零，documentWidth=viewport=320。见 `collection-mobile-before.png`、`collection-mobile.png`。
- **代码审查发现 → 实际 PASS**：锚点点击／hash history 会永久暂停流程；修复后实际点击正文 `#comments`、后退、前进，同一流程 SQL Read 恰一次。见 `anchor-history.json`、`anchor-events.json`。
- **代码审查发现 → 实际 PASS**：带旧 flow 参数刷新会清除新实例；现在刷新生成不同流程并保留续读章节。见 `refresh-flow.json`。
- View 前台判断、会员正文恢复后累计与去重已修正，正向路径实测。真实后台因 IAB／Chrome／锁定桌面的能力限制未实测，不把源审查等同于通过。
- **FAIL → PASS**：刷新／有效合集章节外部直达，旧产物没有重建流程，只保留 work 统计。最终改为一个 ChapterContextProvider 统一验证成员、建立 fresh flow 并正规化 URL，正文与导航共享上下文。真实章节四秒后刷新，新的八秒实例再以真实刷新结束，随后另一个十三秒实例，三个流程 Read 为 0／0／1。有效多合集章节直达仅为所选合集产生一次 Read；无上下文、错误成员及锁定正文都不产生错误 Read。见 chapter-direct-before.json 及 *-final.json。

## 结果

| 范围 | 状态 | 证据／边界 |
|---|---|---|
| 隔离环境与空库／存量迁移 | PASS | 三个独立库；populated-migration 四种旧发布场景；组合完整 migrator 15 条迁移 |
| #27 → #26 组合元数据／DDL | PASS | journal idx12/13/14时间严格递增且非未来，0014 prevId 指向0013且累计visitor表、字段与合集字段；新空库 bundled migrator 15 条全应用。见 combined-metadata.json / combined-schema.txt / combined-migration.log |
| 首页默认／显式保留与权限独立 | PASS | 两种独立作品默认进入、合集内默认隐藏；hide/home 后重新发布仍保持；paid 单篇可显示首页但匿名正文为0。见 initial-data.txt / homepage.log / media-context.json |
| 目录、更新与并发追加 | PASS | 编辑不改原章节序号；共享章节两本合集均更新；两个并发 CLI 新章分别序号4/5；置顶优先于更近更新。见 concurrent-order.txt / collection-pinned.json / collection-sort.log |
| 封面匿名字节与 protected media | PASS | fs封面3603字节/SHA相同；匿名 protected media403/no-store；有效普通会员正文及3605字节媒体同源且no-store。见 media-context.json / private-media-anonymous.json / member-access.json |
| 上传／关联失败、共享引用GC | PASS | PUT三次失败、DB关联失败旧cover/updatedAt不变；clear后只删除零引用新asset，仍引用旧asset保留；缓存实际verified。见 cover-failure.json / cover-failure.log / cover-gc.log |
| 桌面／375与320导航、目录及首尾 | PASS | 首页/合集/订阅/探索；探索只有标签折叠菜单；单阅读入口、日期、权限标志；空态无无效阅读按钮；单篇评论区仍显示。截图与实际AX核对 |
| 本地续读与归属 | PASS | 开始、继续、重读旧章、跨标签storage同步、多合集、作品直达不改、撤回清失效定位、刷新恢复。见 storage-behavior.json / withdrawn-position.json / refresh-flow.json |
| 存储禁用／损坏 | PASS（SIMULATED） | 临时WebAPI SecurityError和坏JSON，实际SPA目录及正文可用并降级开始；故障标签关闭。不是原生隐私设置／真实磁盘配额验收 |
| 匿名／有效／过期会员阅读 | PASS | 锁定、授权、过期三个最终截图；过期普通用户未获得会员正文，13秒预览同流程Read=0。见 member-locked.png / member-authorized.png / member-expired.png / locked-read.json |
| 合集与作品独立采集、跨章去重 | PASS | 真实封面入口Click一次；目录4秒＋正文6.5秒＋下一章＋返回，同流程Read一次；锚点history亦一次；章节View/Read独立。见 browser-first-events.txt / cross-chapter-events.json / anchor-events.json |
| 最终章节流程刷新／外部上下文／history.back | PASS | 三次流程0/0/1；有效外部成员只归所选合集Read1；两种无效归属各13秒没有增加合集Read；锁定fresh context13秒Read0；back返回bare目录新增View2（首次及返回）且同flowRead1。新Provider跨两章及返回ID保持同一，Read1。见 chapter-refresh-events-final.json / chapter-direct-events-final.json / chapter-negative-events-final.json / locked-events-final.json / history-back-events-final.json / cross-chapter-events-final.json |
| event_id重复投递与CLI派生率 | PASS | 真实浏览器已有批次重复投两次，行数2→2；CLI collection/work数值与SQL一致，零分母N/A。见 event-idempotency.json / analytics-cli.txt / analytics-sql.txt |
| DNT／GPC | PASS（SIMULATED） | 全新无埋点文档注入navigator信号后真实链接操作与13秒停留，分析请求0，页面正常。见 privacy-dnt.json / privacy-gpc.json；不代表原生设置已测 |
| 静态检查／正式构建产物 | PASS | 最终独立 pnpm typecheck、pnpm build；bundled API、CLI和 next start真实路径通过。第一次构建后发现章节刷新缺口，新source后按需再构建并只补受影响路径。见 typecheck-final-review.txt / build-final.log / runtime-manifest.json |
| 可见性边界 | PASS（SIMULATED） | document.visibilityState getter和实际visibilitychange事件模拟：隐藏首次12秒无View/Read，仅主动链接Click；首次前台SQL View1；正文4秒前台＋12秒隐藏，SQL collection/work Read均0，恢复7秒后各1。见 visibility-simulation.json / visibility-sql-before-resume.json / visibility-sql-after-resume.json。不是原生后台验收 |
| 真实后台／隐藏首次View、重新授权累计 | UNVERIFIED | IAB各tab均visible，frozen也visible；Chrome session不可用，原生桌面锁定。没有用假visibility代替真实路径 |
| OSS 私有桶真实上传／签名 | UNVERIFIED | 未使用生产密钥；fs 不能证明 OSS 行为 |
| 生产部署 | UNVERIFIED | 用户明确要求暂不部署 |
| 生产当前业务／CDN状态 | UNKNOWN | 本次没有查生产业务、跑真实生产读写或部署，不能从本地推导 |

## 复现与工件边界

完整实际命令、环境创建、临时内容重建方式、SQL/API和CUA浏览器步骤见 `reproduction.md`。架构与代码边界见 `architecture-review.md`。没有添加固定测试程序、维护 fixture 或生产故障钩子；敏感凭据、签名URL和原始会话／visitor ID仅在本次临时目录内，不进入工件。

阶段CLI数字是当时真实回执，不是最终全站固定预期；后续操作会产生新的独立浏览实例。没有用构建、HTTP 200或事件数量单独代替可见业务行为。

清理回执见 cleanup.json。未覆盖真实OSS、浏览器原生后台／隐私设置、生产CDN、多实例吞吐、真实邮件发送、完全关闭进程重开、原生配额耗尽，以及单篇互动写入的完整复投路径。

