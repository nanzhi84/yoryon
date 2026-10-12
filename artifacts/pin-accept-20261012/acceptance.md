# 验收报告：首页文章置顶（Issue #10）

- 运行名：pin-accept-20261012
- 日期：2026-10-12
- 仓库：/Users/yoryon/Projects/yoryon，分支 feat/content-pin，commit 739e4b1
- 隔离环境：API http://127.0.0.1:4321（生产构建）；Web http://localhost:3101（生产构建）；PostgreSQL localhost:54329/yoryon_accept_pin；媒体存储 /tmp/yoryon-accept-pin/media
- 数据前提（验收前核对，与任务一致）：
  - 已发布：pin-accept-alpha(2026-10-01) / beta(10-05) / img(10-07, image) / gamma(10-10)，均 is_pinned=f
  - pin-accept-draft 为 draft，不出现在 feed
  - 验收中新增发布（pin-accept- 前缀隔离）：pg1–pg6、tie（与 alpha 同毫秒 2026-10-01）、pp01–pp14（其中 pp09 与 pp10 同毫秒 2026-09-19，刻意落在第 1 页末/第 2 页首边界），合计已发布 25 篇，均超过 feed 固定页大小 20
- 结论汇总：8/8 PASS，0 FAIL。验收后保留数据未清理（留给主 agent 核对），终态 alpha 置顶。

> 注：/api/feed 页大小为服务端固定 20（FEED_PAGE_SIZE），limit 参数不被读取；因此通过发布至 25 篇制造真实多页，而非调小 limit。

## 1. CLI pin/unpin 语义 — PASS

证据：cli-pin-basics.txt

| 操作 | 实际结果 | 判定 |
|---|---|---|
| `content pin pin-accept-alpha`（首次） | exit 0，"✓ pin-accept-alpha pinned"，cache 事件 verified | PASS |
| 重复 pin alpha | exit 0，"- 已是置顶状态，无需变更"（幂等） | PASS |
| `content unpin pin-accept-beta`（未置顶） | exit 0，"- 已是非置顶状态，无需变更"（幂等） | PASS |
| unpin gamma 重复执行 | 同上，幂等（republish-keep-pin.txt） | PASS |
| pin 不存在 slug | exit 1，"error: 内容不存在: pin-accept-nonexistent" | PASS |
| pin draft | exit 1，"error: 仅支持置顶已发布内容，当前状态: draft" | PASS |
| pin image 类型 | exit 1，"error: 仅支持置顶 article，当前类型: image" | PASS |
| 三类错误后 SQL 核对 | `SELECT slug,is_pinned`：仅 alpha=t，其余不变 | PASS |

## 2. feed 置顶排序与 isPinned 字段 — PASS

证据：feed-pinned.json、snapshot-409.txt

- pin alpha+gamma 后 `GET /api/feed`：items 顺序 gamma(10-10, isPinned=true) → alpha(10-01, isPinned=true) → img(10-07, false) → beta(10-05, false)。两篇置顶在最前且按发布时间倒序（gamma 先于 alpha）；普通文章其后按原时间倒序；每项均含 isPinned 布尔字段。draft 不在 feed 中。
- unpin gamma 后首 5 项：alpha(true) → gamma(false) → pg6 → img → pg5，恢复纯时间序。

## 3. 跨置顶边界分页 — PASS

证据：feed-pagination.txt、feed-pagination.json

- 发布至 25 篇已发布（含 2 篇置顶），沿 nextCursor 翻页：2 页（20+5），末页 nextCursor=null。
- 全集校验：feed 25 条去重后 25；与数据库 `status='published'` 全集逐一比对，缺=[] 多=[]，无重复无遗漏。
- 组内时间倒序断言通过；置顶全部在前断言通过；全程 version 无漂移。
- 同毫秒边界实测命中：第 1 页末 pin-accept-pp09 与第 2 页首 pin-accept-pp10 publishedAt 均为 2026-09-19T00:00:00.000Z，跨页等值条件（三元组游标 id 决胜）不重复不漏项。

## 4. 版本门禁 409 snapshot_expired — PASS

证据：snapshot-409.txt

- 置顶变更前 version=a72f219a…；unpin gamma 后：
  - `GET /api/feed?version=<旧>&cursor=<旧cursor>` → HTTP 409 `{"error":{"code":"snapshot_expired","message":"列表已更新，请刷新页面"}}`
  - `GET /api/feed?version=<旧>`（无 cursor）→ 同样 409
  - 不携带 version → HTTP 200，新 version=e4c926c4…，排序正常

## 5. 重新 publish 保留置顶 — PASS

证据：republish-keep-pin.txt

- 修改 /tmp/yoryon-accept-pin/posts/post-alpha/index.md 正文后 `pnpm cli publish`：成功，content id 不变（72bb0a68-…）。
- SQL：is_pinned=t，body_markdown 含修订文本。
- feed 首位仍为 pin-accept-alpha，isPinned=true，publishedAt 仍为 2026-10-01T00:00:00.000Z。

## 6. 浏览器可见结果与缓存刷新 — PASS

证据：web-home.txt；HTML 快照 /tmp/yoryon-accept-pin/home-{before,after-pin,after-unpin}.html

- 首页 HTML（SSR）文章顺序与 API 一致；置顶文章带 `<span …>置顶</span>` 徽标，仅置顶项有；日期为原发布时间（alpha 显示「2026年10月1日」）。
- 缓存实际刷新（web 未重启，连续 curl 对比）：
  - pin gamma 后首页前 3：gamma(置顶) → alpha(置顶) → pg6
  - unpin gamma 后首页前 3：alpha(置顶) → gamma → pg6
- 详情页 `GET /p/pin-accept-alpha` → HTTP 200，正文含重新 publish 的「已修订 re-publish」。

## 7. 标签页不受置顶影响 — PASS

证据：tag-page.txt

- API `/api/tags/pinaccept`：首项为 gamma（最新），alpha 虽置顶但按时间位于第 9 位；25 条分 2 页翻到底，无重复无遗漏，末页 nextCursor=null，全程纯时间倒序断言通过。
- Web `/tags/pinaccept` HTML 前 3：gamma → pg6 → img，与 API 一致，无「置顶」徽标。

## 8. content list 置顶状态列 — PASS

证据：content-list.txt

- 输出为 TSV：status / visibility / type / pinned 列 / slug / title。alpha 行第 4 列为 `pinned`，其余为 `-`。

## 未覆盖项

- 未用真实浏览器渲染（仅 curl SSR HTML 校验结构、徽标与顺序）；未验证 LoadMore 前端交互。
- 多置顶（≥3 篇）与「置顶数超过一页」场景未覆盖。
- 并发 pin/unpin 竞态未覆盖。
- 未覆盖 image 类型详情页渲染（与本变更无关路径）。
