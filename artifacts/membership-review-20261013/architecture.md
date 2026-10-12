# PR #22 架构独立审查

审查源码：`17c09e45895646643bd2bad41830ee3bff7fedc5`。风险级别：LOW，限定为本轮源码和隔离运行证据。技术栈：Next.js 15.5.27 BFF、Hono、PostgreSQL/Drizzle、source-only core/config/db、CLI、sharp、FS/OSS适配器。使用 `/Users/yoryon/.codex/skills/architecture-review/SKILL.md`，只读源码；宿主 typed findings 未使用。

检查范围：`ab6e744...17c09e4` 的源码差量、完整关联模块与 ADR-0001/0004/0006/0013；协议与领域投影、模块依赖方向、问答/作品外键和权限、通知目标、缓存头、发布/上传/GC锁、迁移、客户端取消/分页/重试、资料与媒体存储边界。手写源码关键模块为92–444行；未发现新增超过500行的模块。这里只声明所读变更图，没有把未扫描的全仓库判定为无环。

依赖方向：Web使用显式DTO及BFF接口；API协议层调用core并转换DTO；CLI复用core；core→db/config/storage契约，未反向依赖Next/Hono/CLI。问答不是contents的假作品，comments显式 target_kind + content_id / question_id XOR及外键。历史作者资料实时联查 users 并通过 `toAuthorDto` 投影，邮箱和会话信息留在认证边界。

## 已解决的具体问题

1. **问答通配中间件跨模块限制头像**。旧 `questionRoutes app.use('*', bodyLimit32KiB)` 经 `/api` 挂载展平，使166517字节的合法JPEG在API/BFF均413，2MiB头像合同被破坏。最终 `apps/api/src/routes/questions.ts:42` 明确记录原因，32KiB限制只绑定POST /questions及PATCH /questions/:id；`profiles.ts:49`保留独立2MiB。实际同图API/BFF200、ProfileForm320px图加载，流式上限2MiB/2MiB+1和32KiB/32KiB+1已分别验证。
2. **合集上下篇DTO没有视图消费**。旧ContentView只显示合集入口，真实中间作品没有上一/下一篇。最终 `apps/web/components/content-view.tsx:44` 接入22行独立CollectionNavigation，中央/首/尾真实浏览器复验正确，付费邻篇继续落在原canAccess详情路径。

最终没有未解决的阻断项。通配no-store同步收窄到各功能路径，`apps/api/src/middleware/auth.ts:38`保留身份线默认private/no-store，认证失败及不存在错误也不依赖其他模块“顺带”设置头；实际401/404与公开feed头各自核对。

## ADR 对齐与故障边界

| ADR | 结论 | 证据及边界 |
| --- | --- | --- |
| 0001 BFF与认证 | PASS | Cookie→Bearer路径真实注册/验证/登录/兑换；身份响应no-store，公开线不读session；错误头抽验。 |
| 0004 付费正文/媒体 | PASS（隔离范围） | 单篇/合集权益不取得会员问答资格；API/SSR/hydration无权限不含回答标记；撤销后付费正文回落；未证明生产CDN。 |
| 0006 发布/GC互斥 | PASS | 头像上传与GC共享 advisory lock；持锁GC跳过、上传等待释放；引用保留/失效删除及真实失败孤儿回收。 |
| 0013 问答/资料 | PASS（隔离范围） | subscription判资格、user/month唯一；私密/隐藏隔离、本人历史回答；纯文本视图；当前作者DTO；sharp去EXIF/320WebP、动画/像素/MIME/大小拒绝。 |

月度并发通过真实请求与SQL约束核对，问答最近活动版本游标实际409后刷新恢复；scope切换通过abort和scopeRef阻止旧请求覆盖，但长时间后台自发到期而不重新加载页面的显示更新未额外现场测试。资产先写对象后提交DB的故障会留下孤儿，实际用户行锁超时已复现，此孤儿经过24小时宽限由既有GC清理，没有吞错掩盖失败。

部署前提：API需读写avatars/*而不能因此获得media/*发布写入权限，CLI GC需头像对象读/列举/删除。隔离FS已经过验收；生产OSS IAM、真实CDN/区域及迁移存量现场结果仍UNVERIFIED。代码回滚保留新增表/列与数据的ADR说明合理，未执行破坏性逆迁移。
