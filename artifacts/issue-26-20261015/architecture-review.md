# 架构与代码独立审查

审查范围：Issue #26 的 CLI/core/db/API/web 变更、相关 ADR 与真实执行。已阅读 architecture-review 技能，保持生产源码只读。阶段源码 `32aeb3b81265ebebb44da0d0107f4a6a2c00ff9d`；最终组合源码、构建及独立补验为 `3038fda97569dd5aeff1f95e39c505b2615dc639`。

风险等级：LOW（已确认路径）；实际 OSS、真实后台与下列未覆盖边界不能由本地结果推导。

## 依赖与领域边界

- 发布／封面：CLI → core → 既有 MediaStorage / DB；`media-upload.ts` 在第二个真实用例出现时提取媒体准备、内容寻址上传与元数据写入。集合封面先上传、后单事务关联与 outbox，沿用同一 publish/GC advisory lock。没有第二个存储系统，也不将字节／临时签名 URL 存库。
- 展示／授权：web 仅使用公开 DTO、同源 BFF 和公开章节成员 API；没有 web → db/core 的新依赖。会员正文仍只由 core.canAccess / API 统一校验，合集上下文与浏览器记录不授予权限。章节上下文 API 在只读一致快照内只返回当前发布的成员与相邻元数据。
- 阅读记忆：稳定集合／章节 ID 与版本／时间是可选定位数据，不保存凭证、正文、权限或 URL。写入位于实际授权正文组件，经成员 API 校验；直达作品无合集上下文时不写合集记录。
- 合集统计：根 Provider 持有单浏览器导航流程，读者退出链路即清除；目录和已展示授权正文共同计时，作品自身 View/Read 仍独立。服务端 event_id 唯一约束与现有重试合同继续使用，CLI work/collection 分开聚合。
- 本次新增／改动的主要手写文件均低于 500 行：publish 300、contents 路由 299、collection-reader 100、collection-flow 86、chapters context 66、collections 路由 66、media-upload 47、collection-cover 32。
- 最后的章节修复使 chapter-reading 统一 Provider 约 110 行，单一拥有者执行成员校验与流程正规化，正文／导航消费同一状态；没有把两个请求路径用兼容 shim 继续保留。
- 在本次模块依赖路径中未发现循环依赖。鉴权、媒体访问与 outbox 仍在既有边界，没有新授权入口或可持久化共享可变权限状态。

## 发现与修复回执

| 问题 | 失败方式 | 修复与独立复验 |
|---|---|---|
| 迁移把旧会员作品设为首页可见 | 旧首页仅 public；若所有存量 show_in_home=true，升级会新增 paid 项到首页 | 按旧 visibility 初始化。四种旧已发布场景实测 public true、paid false，包括旧合集成员；排序关系保留 |
| 手机目录隐藏章节日期 | `collection-reader.tsx` 原 time 使用 hidden/sm:block，375px 实际目录没有日期 | 所有断点展示，320px 每个日期可见且无横向溢出 |
| 同页锚点导致合集计时永久暂停 | 原 departure 对比含 hash 的 href；原 pop 无条件暂停，但 route effects 不重启 | 忽略 hash，pop 仅在实际 route 改变时暂停。真实 #comments 点击与 back/forward 后 SQL 同流程 Read=1 |
| 旧 flow URL 刷新清除新流程 | URL 仍带旧 flow，但根状态已重建，新流程会被 observer 清掉 | 目录判断不使用旧 URL flow 清除当前新实例。实际刷新生成不同流程并保留续读章节 |
| 前台恢复重新挂载 WorkBodyTracker 丢失／重复累计 | body 重新校验后重新挂载会重置局部累计与 sent | 进度移到 WorkDetailProvider；源审查确认加载中不计时。真实后台受当前浏览器／锁定桌面限制，未冒充通过 |
| 后台 mount 立刻产生 View | 原 DetailTracker mount 不检验 visibility | 新 View effect 等前台并 trackOnce；已复验正向真实页面与流程去重，后台 mount 仍未现场验证 |
| 有效合集章节刷新／外部直达不建立流程 | 根内存已清空，旧 body/nav context只读取URL flow而不新建 | 统一 ChapterContextProvider 在成员验证后建立零累计的新流程；实际刷新三个实例Read0/0/1，有效外部成员Read1，无ctx／非成员不新增Read，锁定预览Read0 |

当前未发现尚未修复、能在可用环境复现的阻断性代码／架构问题，可合并。前台／隐藏 WebAPI 边界另外完成受控模拟：隐藏初始没有 View/Read、首次前台 View1、4秒前台+12秒隐藏Read0、恢复7秒Read1；原生后台回归及正式 OSS 链路仍明确未验证。

## ADR 一致性

| ADR | 状态 | 审查结论 |
|---|---|---|
| 0001 BFF / Bearer | 符合 | 没有新增管理 API；CLI 管理与浏览器身份保持分离 |
| 0002 统一权益 | 符合 | 合集目录不改变单篇权益；公开 cover 不放开独立会员正文媒体 |
| 0003 缓存分线 | 已实测对应路径 | 公开列表为 public；目录权益／会员正文为 private,no-store；封面免费签名和授权媒体缓存区分 |
| 0006 媒体生命周期 | 已实测 fs 路径 | 内容寻址字节一致、上传／事务失败旧关联保留、共享引用 GC 安全；OSS 未验证 |
| 0007 Analytics | 已实测对应路径 | event_id 原样复投未新增行；work/collection 数值与 SQL 一致；DNT/GPC 用 WebAPI 边界模拟 |
| 0010 发布缓存 | 已实测本地路径 | 事务 outbox 与真实公开页面预热核验 verified；CDN／生产缓存未验证 |
| 0016 合集阅读 | 已实测核心路径 | 默认／显式首页、稳定目录、真实连续阅读、跨页流程与本地定位符合需求；覆盖范围见独立验收 |

host rendering: not available。本报告不把结构观察包装成没有真实失败路径的高优先级问题。

