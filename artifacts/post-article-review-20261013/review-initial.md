# Issue #18 独立只读初审

日期 2026-10-13（Asia/Singapore）。主代理授权先审设计/代码、待 #15 迁移整合后再现场验收。初始审阅 `b5adc5bd542a91efa054d1d17517a16bacce877c`，修正白名单/node 后版本 `f5608b601f59916083d9570e21f3fec034c20e7b`；实际基准 `origin/main=24000316eb49dfdc9f66f4f3688b257a037eadda`。

**初审结论：BLOCK，需收口付费旧主媒体迁移的预览保真、引用帖子的正文媒体预览，以及新读取超时；业务验收 UNVERIFIED。** 本报告是中间记录，后续修复状态须以最终冻结版本复核报告为准。

## 已确认的合同缺口

1. **P1：prepend 旧付费主媒体改变百分比预览。** `docs/adr/0014-post-article-references.md:21` 计划在正文开头补主媒体；`apps/api/src/routes/post-feed.ts:17` 仍从变更后的正文计算百分比。原付费 video 的正文为 1000 个纯文本字符、percent20%，现有正式 helper 原可见 200 字；prepend 权重300的主视频后总权重1300/预算260，首媒体块已超预算，公开正文为空。后置 exposure 过滤不能恢复消失的文字。一次性纯 helper 回执 `primary-preview-probe.txt`；没有操作数据库或真实文章。建议在迁移之前计算旧公開预览，将它保存为当前 revision 的派生投影；以后正式发布事务重新生成当前投影，各公开消费者复用，避免保留旧全文或改变普通百分比语义。
2. **P2：引用无封面 post 不展示正文媒体预览。** `apps/api/src/routes/references.ts:17` 只投影摘要与 coverMediaId，`apps/web/components/work-reference.tsx:43` 只渲染封面。无封面但有公开图片/音视频的帖子被引用时，允许的媒体全部丢失。Issue #18 明确要求帖子卡片展示正文摘要与允许的媒体预览。可只投影一项当前公开预览媒体，二次核对 exposure，媒体控件放在跳转链接之外；不递归引用或返回全文。
3. **P2：新读取缺少时间上限。** `apps/web/components/post-entry.tsx:30` 与 `apps/web/components/work-reference.tsx:18` 使用生命周期 AbortController，没有 deadline。请求悬挂时保持 loading；帖子展开按钮 disabled，无法从正常交互进入失败/重试。建议将生命周期信号和有界 timeout 组合，超时显示 error/retry，主动取消保持静默。

## 已修复或撤回的初始观察

- 早期 BFF 白名单未包含 `/api/public/references/:id`，导致浏览器引用请求被404并误显示不可用。主代理修复后已从 f5608b6 源码确认合法 UUID 路由放行；真实浏览器仍待验收。
- ReactMarkdown 的 img props 含 `node`，早期全部传给 Client MarkdownImage。主代理已剥离 node，仅传图片属性；原观察属于非必要 AST 投影风险，未证明泄露或 RSC 崩溃。
- 本 reviewer 曾将早期预览 snapshot 当成当前 main，误称 #18 新增 textPrefix 会扩大原付费文本预览。直接核对 `git show origin/main:packages/core/src/preview.ts` 与当前 diff 后确认 textPrefix 已在基准 main，#18 只增加 Feed 上界；**撤回该项，不计为缺陷**。正文保真问题仅是主媒体 prepend 改变权重。

## 结构与权限审查

- 核对 `publish -> collect/replace references -> invalidateReferrers -> enqueueCacheEvent` 的事务边界，引用稳定 UUID、目标删除 set-null 保留身份、直接引用者 revision 与缓存事件在同事务变更；无多跳递归，引用摘要跳过指令/图片/HTML。
- 核对公开/私有详情投影、Feed 先权益裁剪再 900权重/6块折叠、MarkdownSurface 同步客户端渲染与 async Shiki 服务端分离。未发现新增依赖方向逆转或将付费全文传入公共 PostEntry props 的证据。
- 无标题 post 使用稳定 slug/ID、页面 metadata/可访问名称回退。普通展开、媒体播放与图片查看未进入详情统计 wrapper；明确链接沿用 TrackClickLink。
- 单跳引用在目标更新/下线/删除时更新直接引用者 revision；公开图片在缓存字节前用实时 SQL gate。签名 URL 自身既有有效期不是本次即时撤销的新保证。
- 首页免费/订阅付费分区、问答领域和评论入口待 #14/#15 整合；当前 #18 单独源码不具备完整完成态，不能把关联分支的未整合状态当作已交付。

## 下一轮需复核的设计

主代理已接受 preview 派生投影、引用媒体和 migration application entry 方案，尚未在本初审版本实现。提醒：`invalidateReferrers` 只改父作品 revision，不改其正文/预览规则；若预览投影原匹配旧 revision，应保留投影并同步 previewRevision，避免目标更新触发 legacy 父作品从 prepend 正文重算而丢失旧边界。SQL 人工修复改变正文/规则/revision 时的 mismatch 应重算或失败关闭，不可返回旧公开全文。

待正式迁移顺序确定后再独立执行：空库全部迁移、旧四类型恢复表与还原、旧付费百分比/marker/full精确预览对照、媒体字节与曝光、预热引用目标变更/权限收紧、移动/桌面折叠与资源释放、无标题发布、非法自引用/草稿引用、post/article 评论和会员权限。当前开发库 drizzle push 和 HTTP/构建成功不构成这些业务 PASS。

只读审查使用 architecture-review 技能。此 reviewer 未改任何实现代码；只在本工件目录写报告与非执行回执，未新增固定测试程序、fixture 或 harness。
