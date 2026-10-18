# ADR-0021：目录范围版本与有限预热

日期：2026-10-18

## 原因与边界

以最新 cache_events.id 作为全站目录版本，使无关合集改名也更换所有列表的 Data Cache URL。每次事件遍历 paths 预热还放大了合集及关联文章的生成。

保留实时版本门禁，避免失效回调失败时旧分页继续返回已下架的帖子或预览，以及排序变化后游标漏项。单靠 revalidateTag 无法满足这个失败路径。此次不改变正文访问权益：合集 visibility 是目录属性，canAccess 仍由作品自身 visibility 与实时权益决定，免费文章不会因合集标记 paid 自动变成付费。

## 决策与数据流

- catalog_versions 按 feed（首页文章）、post-feed、paid-feed、member-feed、collections、tag:<slug> 保存 UUID。业务变更、outbox 和受影响范围版本在同一事务提交；缺省版本是零 UUID。API 只读，CLI 写入；投递重试不修改版本。
- 发布根据变更前后 type/status/visibility/showInHome 的并集，失效实际涉及的文章或帖子列表、付费目录、标签及关联合集。无关标签和另一类公开列表保持原版本与缓存 key。关联合集的 updatedAt 及计数也可能改变，因此更新订阅聚合范围。
- Web 首屏先 no-store 查询指定 scope，再读取该版本的 Data Cache；409 时有界重读。分页 Middleware 同样按 source 对应的 scope 校验旧版本，API 在 repeatable-read 事务中读取版本和分页数据。scope 参数必填且校验，未知范围拒绝；存储不使用进程内状态或事件历史扫描。
- 首屏与分页数据缓存协议改为 catalog-v6，避免继承旧协议的共享 feed tag。保留 24h 兜底，仅相关列表换 key；本文不承诺完全消除列表重生成或 ISR 写入。
- 合集更新省略 description/visibility 时保留原值，新建默认空描述/public；完全相同的元信息不产生事件。合集名称、简介和章节排序不改成员 revision/updatedAt/previewRevision。仍按 content:<slug> 失效嵌入的合集名和上下篇信息，在后续访问时更新。已有合集 visibility 变化才原子轮换成员 revision，previewRevision 与旧 revision 一致时同步轮换；章节成员关系仍由内容发布维护。
- 投递器不再遍历 event.paths 发 GET。只在 feed 变化时预热首页；event.contentSlug 仅代表直接修改的作品，预热其 /p/<slug>。合集、标签、分页、sitemap 和关联引用者仅失效，按访问生成。不发送 cache-control:no-cache 强制刷新。
- verified 表示签名失效回调成功及上述有限预热核对通过，不代表所有 paths 已生成、浏览器验收或平台计费下降。失败保留有界重试与人工 cache retry。

## 发布、隔离与回滚

1. 暂停发布 CLI；先以 owner 执行 pnpm db:migrate（包含 0015），执行 deploy/grant-catalog-versions.sql。API 角色仅 SELECT；CLI 仅 SELECT/INSERT/UPDATE。迁移不会修改历史事件、内容正文或已有 revision。
2. API、CLI 与 Web 需要配套更新：新 Web 的 catalog-policy 必须 scope 参数，新 API 不提供旧全局版本接口。不要让旧 CLI 在新 API/Web 上继续发布（旧写入器不会推进范围版本）。在维护窗口切换，完成后恢复 CLI。此变更没有添加旧内部路径兼容层。
3. 真实运行验证命令为 pnpm typecheck、隔离 API 下 pnpm build；独立验收工件位于 artifacts/cache-scopes-20261018/acceptance/，包括 CLI/SQL/浏览器与失败回调、旧分页证据。不向生产写入验收数据。
4. 回滚须配套恢复 API、CLI 和 Web 的旧版本；新表可保留，不需删内容或倒退 revision。重新发布前确认运行三端协议一致。若期间存在实际权限变化，不得恢复旧业务数据。

## 已知取舍

同一列表内的任意变更仍推进整个范围版本；本轮没有做到逐页内容哈希。合集改名或排序虽不轮换正文版本，成员数据内嵌的合集信息仍需失效。Webhook 失败时这些展示元信息可能暂旧，但正文/分页的撤销继续由实时门禁保护。平台 ISR 用量下降需发布后单独观测，不能以本地请求数代替。
