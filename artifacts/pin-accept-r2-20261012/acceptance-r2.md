# 验收报告（第二轮）：首页文章置顶修复提交 593eb1f

- 运行名：pin-accept-r2-20261012
- 日期：2026-10-12
- 仓库：/Users/yoryon/Projects/yoryon，目标提交 593eb1f（fix(review): 处理 GPT 6.1 评审发现）
- 隔离环境：API http://127.0.0.1:4321（tsx 源码）；Web http://localhost:3101（生产构建）；PostgreSQL localhost:54329/yoryon_accept_pin；媒体 /tmp/yoryon-accept-pin/media
- 结论汇总：6/6 PASS（第 6 项按任务要求只记录实际行为），0 FAIL。
- 验收后终态：仅 pin-accept-alpha 置顶；cache_events 无未验收事件；feed version=b624c9d0；未删除任何既有数据。

## 环境前提事件（两次上报主 agent 处理，均非被测代码缺陷）

1. 初始状态下 4321/3101 进程启动于 21:22，早于提交 593eb1f（21:44:57），api.log/web.log 开头均为 EADDRINUSE（此前重启失败，旧进程服役）。实测 /api/tags/pinaccept items 无 isPinned、nextCursor 为三元组——修复前行为。上报后主 agent 按端口重启。
2. 重启后 web 进程未继承 env.sh 的 CACHE_REVALIDATE_SECRET（启动命令 shell 错误），签名投递 403。用 packages/config/src/cache-signing.ts 算法手工构造合法签名请求仍 403 确认。上报后主 agent 以 `set -a; source env.sh` 重启 web，签名验证恢复（探测返回 400 invalid targets 即过了签名校验）。
3. 验收进行期间（21:56:46）工作树推进到 dd445c6（分页错误链路闭环：BFF /api/pages 透传 400/409、LoadMore invalid_cursor 恢复路径、注释措辞），该提交把当时已产出的部分工件一并提交。运行中的 API/web 构建均为 593eb1f 内容，本报告结论针对 593eb1f；dd445c6 改动不经我测的 API 直连接口，不使本报告失效，但其本身不在本轮验收范围。

## 1. 标签游标向后兼容 — PASS

证据：tag-page1.json、tag-old-cursor.txt、cursor-400-checks.txt

- 取标签页第 5 项 pin-accept-beta（t=2026-10-05T00:00:00.000Z, id=a6dc45ff-…）手工构造旧格式二元游标 base64url(JSON {t,id})：`eyJ0IjogIjIwMjYtMTAtMDVU…`。
- `GET /api/tags/pinaccept?cursor=<旧游标>` → HTTP 200，返回恰好游标位置之后的 20 条（pg4…pp14），与游标之前 5 条零重复；因 25 条全集正好取尽，nextCursor=null，无遗漏。
- 附带验证：带 p 字段的三元组游标请求标签接口同样 200（多余字段被忽略），新旧游标均可解码。
- 同一旧格式游标（缺 p）请求 `/api/feed` → HTTP 400 `{"error":{"code":"invalid_cursor","message":"分页游标无效，请刷新列表"}}`。
- 乱串游标 `not-a-valid-cursor!!!`：/api/feed 400 invalid_cursor；/api/tags/pinaccept 400 invalid_cursor。base64 合法但非 JSON 的游标（aGVsbG8gd29ybGQ）/api/feed 亦 400。

## 2. 置顶类型守卫 — PASS

证据：publish-type-guard.txt、type-guard-sql.txt、republish-after-restore.txt

- 前置 SQL：pin-accept-alpha type=article, is_pinned=t, status=published。
- 修改 /tmp/yoryon-accept-pin/posts/post-alpha/index.md 加 `type: image` + `media: pixel.png`（pixel.png 拷自 img-delta），`pnpm cli publish`：
  - 输出 `error: pin-accept-alpha 处于置顶状态，仅 article 可置顶；变更类型前请先 blog content unpin pin-accept-alpha`，pnpm Exit status 1。
  - 失败后 SQL 核对：type=article、is_pinned=t、body 未变（媒体上传阶段的 skip 无副作用到 contents 行）。
- 恢复原 index.md（移除 pixel.png）重新 publish：exit 0，content id 不变（72bb0a68-…）；SQL 仍 article/is_pinned=t；feed 首项 alpha isPinned=true。
- 该次 publish 的缓存事件 b52de57f 因当时 web 密钥环境问题 failed（见环境事件 2），后并入第 6 项 retry 转 verified。

## 3. 标签 items 合同 — PASS

证据：tag-page1.json、tag-ispinned-check.txt

- /api/tags/pinaccept 第一页 20 项全部含布尔 isPinned 字段；仅 pin-accept-alpha 为 true，其余 false。

## 4. 标记显示上下文 — PASS

证据：web-home.html、web-tag.html、web-badge-check.txt

- 首页 `/`：alpha 条目 HTML 为 `<div class="flex items-baseline justify-between gap-4"><div class="flex min-w-0 items-baseline gap-2"><a …><h2>置顶测试·甲</h2></a><span class="…shrink-0">置顶</span></div><time class="shrink-0 …">2026年10月1日</time></div>`——徽章与标题在左侧同一 flex 组内相邻，日期 time 在右侧（justify-between）。DOM 中徽章 span 恰 1 处（仅 alpha），非置顶条目（如 gamma）无徽章。
- 标签页 `/tags/pinaccept`：含 alpha 链接（1 处）但全页无徽章 span（`shrink-0">置顶<` 计数 0）；「置顶」字样只以标题「置顶测试·*」形式出现（排除标题后 grep 计数 0）。
- 说明：本轮仅用 curl 校验 SSR HTML 结构，未用真实浏览器渲染。

## 5. 回归 — PASS

证据：regression.txt、tag-page1.json

- feed 第一页首项 pin-accept-alpha，isPinned=true，publishedAt=2026-10-01。
- 标签页 20 项 (publishedAt desc, id desc) 全序单调成立；置顶的 alpha 位于第 9 位（index 8），排序不受置顶影响。
- 旧 version（第一轮 e4c926c4-…）请求 /api/feed：带与不带 cursor 均 HTTP 409 `snapshot_expired`。

## 6. 投递失败窗口行为记录（按要求不判 FAIL） — 已记录

证据：delivery-window.txt、web-home-beta-pinned.html

- T0：version=b9cad7f8；唯一未决事件 b52de57f（环境事件 2 所致 failed/invalidation HTTP 403）。
- 另开 shell 以 `CACHE_REVALIDATE_URL=http://localhost:59999/api/revalidate`（不可达）执行 `content pin pin-accept-beta`：CLI exit 0，输出 `cache 285ac842-…: pending (retry exhausted; blog cache retry)` + `✓ pin-accept-beta pinned`。DB 内该事件 state=failed、attempts=3、last_error=`fetch failed`（注意：CLI 文案写 pending，DB 终态为 failed，retry 子命令对 failed 同样捞起）。
- 失败窗口内观测（与代码注释/已知权衡一致）：DB 已改（beta is_pinned=t，feed 实时读库首项已为 beta）；但 version 未推进（仍 b9cad7f8），携旧 version 请求 /api/feed 返回 200 而非 409；web 首页 SSR 缓存未失效，beta 条目仍无徽章（旧缓存可观测）。
- 恢复正确 URL 后 `pnpm cli cache retry`：两个事件（b52de57f、285ac842）均 verified，attempts=4；version 在投递成功后才推进到最新事件 285ac842；此后旧 version b9cad7f8 请求 → 409；首页缓存刷新后出现 2 处徽章（alpha+beta）。
- 恢复环境：`content unpin pin-accept-beta`（正常环境，事件 b624c9d0 即时 verified）；终态仅 alpha 置顶、cache_events 无未验收、首页徽章回到 1 处、feed 首项 alpha。

## 未覆盖项

- 未用真实浏览器渲染与 LoadMore 前端交互（含 dd445c6 新增的 invalid_cursor 恢复 UI）。
- dd445c6（/api/pages BFF 透传 400/409）不在本轮范围，且运行中 web 构建早于该提交。
- 并发 pin/unpin 竞态、多置顶超过一页场景未覆盖。
- cache retry 的有界性（>100 事件、单事件 >3 次）未触及。
