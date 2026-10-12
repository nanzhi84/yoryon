# 独立现场验收：旧正文请求跨越 SQL + refresh 窗口

执行时间：2026-10-12 15:45–15:49 UTC。环境为隔离 PostgreSQL 55439、API 4439、生产 `next start` 3139（Node inspector 仅 localhost:9239）；数据库操作前检查 DATABASE_URL 端口为 55439。仅创建 `race-refresh` 合成文章，不使用真实付费内容。无业务钩子、代理 harness 或可执行验收脚本。

## PASS：实际跨窗与失效投递

通过真实 `pnpm cli publish /tmp/yoryon-race/race-refresh` 创建文章，正文为 `RACE_VISIBLE_SYNTHETIC`、`<!-- more -->`、`RACE_RESTRICTED_SYNTHETIC`。

内联 Node 调用 CDP `Debugger.setBreakpointByUrl`，在已构建 Next `getPublicContent` 的 `await response.json()` 之后、返回之前设条件断点 `a === "race-refresh"`，并发请求 `/p/race-refresh`。`Debugger.evaluateOnCallFrame` 只提取 slug/revision/access/合成标记布尔值；未读取其他文章。

- 15:46:14.005 暂停帧证实：旧 revision `f124123b-1e84-4a52-8096-d8015b316cd7`，`access=full`，已取到受限标记。
- Next 保持暂停，API 独立运行；执行 `UPDATE contents SET visibility='paid', preview_mode='marker' WHERE slug='race-refresh'`，继而真实 `pnpm cli cache refresh race-refresh`。
- 15:46:48.884 CLI 已退出 0，查询数据库证实新 revision `17cc820d-e649-47e1-970f-3f5c531038d9`、paid/marker 已提交。该事件投递因 Next 暂停实际超时 3 次，状态 failed，故此场景确实不依赖成功失效投递。
- 移除断点并 `Debugger.resume`。开始于收紧前的在途请求返回 200 和旧合成全文；这部分未撤回，不将其算作新请求权限通过。
- 随后的旧 `/render/<旧revision>/race-refresh` 返回 404、`private, no-store`，无合成正文；新 canonical 连续请求均 200，仅预览和可见标记，受限标记不存在。

原始回执：`race-receipt.json`（JSON Lines）。

## PASS：86400 秒真实 Data Cache 与迟到旧缓存

实际检查 `.next/cache/fetch-cache` 文件，两份 cache 的 revalidate 均为 86400，分别含旧 full 与新 preview。旧 cache 文件 mtime 为 15:46:48.900 UTC，晚于 CLI refresh 完成回执，说明旧内容确实在刷新事务后落入 Data Cache，但旧 render 门禁仍拒绝新请求。缓存元数据、URL、SHA256、mtime 和内容布尔值见 `race-cache.json`。

另执行受控缓存命中检查：临时将同 revision 的合成标题改为 `RACE_CACHE_ORIGIN_CHANGED`，直读 API 确认为新标题；请求 Next canonical 仍显示原 `Synthetic refresh race`，无新标题且无受限标记，证实真实服务复用缓存，而非仅查看配置。随后恢复标题。回执见 `race-cache-hit.json`。

## 范围与未验证

- PASS：请求真实取得旧全文后，SQL + refresh 提交，失效投递失败，旧响应迟到；之后的新请求不能通过旧 revision 门禁。新版匿名正文仅预览。
- PASS：本机生产 Next 的 86400 秒 Data Cache 实际命中及迟到落盘。
- UNVERIFIED：本次页面响应没有 `x-nextjs-cache: HIT`，响应为 private/no-store，未证明 Full Route Cache HTML 或外部 CDN 命中，不能把 Data Cache 结果写成 CDN/Full Route Cache 已通过。
- PASS：成功投递失效事件与暂停旧渲染并发的窗口，补验如下。
- 已在收紧前通过门禁且取得全文的请求仍可完成；本实现保障收紧后新请求，不撤回既有传输。


## PASS 补验：真实成功失效后，旧渲染迟到

为让暂停旧渲染与正常失效请求同时发生，启动第二个真实 `next start -p 3140`，共用同一生产 build 和 `.next` Data Cache 目录，未使用代理或替身。最初隔离配置的签名密钥长度不足导致 403；主 agent 修正为有效合成密钥并重启 API/Next 后，3140 同样重新启动。密钥不进入工件。

新独立文章 `race-success` 的请求在 3139 上使用同一条件断点暂停：15:51:05.501，已取得旧 revision `09c11e9b-2a4f-4c36-90e1-3e71fea740a5` 的 full 和受限标记。SQL 将文章设 paid/marker，然后调用真实 CLI：

```
CACHE_REVALIDATE_URL=http://127.0.0.1:3140/api/revalidate SITE_URL=http://127.0.0.1:3140 pnpm cli cache refresh race-success
```

- API 与 3140 均正常处理签名事件、失效、预热与验收。事件 `dec84a74-3f28-4d49-9c8b-7335effd2862`：state=verified，attempts=1，invalidated_at=15:51:09.589，verified_at=15:51:10.106，last_error=null。
- 15:51:10.181 查询确认新 revision `7e7bb4b2-2c16-40f0-8cff-0c1315efa3b1` 已提交、CLI 完成后，才恢复 3139 的旧请求。
- 旧在途请求完成并返回旧标记，但新请求旧 render 404，新 canonical 连续两次 200 且只有预览，无受限标记。
- 旧 full Data Cache 在 15:51:10.188 才落盘，晚于成功失效、验收和 CLI 完成；revalidate=86400。因此本次实际覆盖成功刷新后迟到旧缓存，不能仅靠失效成功防止的窗口由 revision 门禁挡住。

完整回执见 `race-success-receipt.json`，缓存元数据见 `race-success-cache.json`。此双本机实例共享文件缓存不等同生产分布式 CDN；Full Route Cache/CDN 仍未验证。

## 清理

已删除独立合成文章 2 条及其事件 4 条（见 `race-cleanup.json`），清理本次文章独立 Data Cache 文件、临时文章目录，并关闭第二实例 3140。未删除其他验收者的数据或缓存。
