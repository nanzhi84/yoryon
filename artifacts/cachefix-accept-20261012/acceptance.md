# Issue #13 缓存修复独立验收报告

- 验收日期：2026-10-12（现场执行，独立验收 agent）
- 工作树：/Users/yoryon/Projects/yoryon-pr2-cachefix @ commit 5272fd6 `fix(cache): 刷新权限边界与重试耗尽事件阻塞投递`
- 环境：API http://127.0.0.1:4322；Web（生产构建）http://localhost:3102；DB psql 127.0.0.1:54329/yoryon_accept_cachefix（隔离库）
- 数据前提：种子内容 cachefix-target（article、published、public、preview_percent=50；正文付费区含标记串 `FULLPAIDBODY-MARKER-7f3a9c`）
- 所有 CLI 命令先 `cd /Users/yoryon/Projects/yoryon-pr2-cachefix && set -a && source /tmp/yoryon-accept-cachefix/env.sh && set +a`
- 所有 HTTP 请求均为匿名（无认证头）

## 总体结论

| 验收要求 | 场景 | 结论 |
|---|---|---|
| 1. SQL 收紧权限后 refresh 使旧渲染无法重填缓存（权限边界） | A1–A4 | PASS |
| 2. cache refresh 原子轮换 revision + updated_at | A3 | PASS |
| 3. 重试耗尽事件（attempts>=3）不阻塞新事件投递；retry 有界恢复 | B1–B5 | PASS |

## 场景 A：权限收紧与 revision 轮换

### A1 预热与基线（PASS）

- `curl http://localhost:3102/p/cachefix-target` → 200，HTML 中 `FULLPAIDBODY-MARKER-7f3a9c` 出现 2 次（全文可见，符合 public）。
  - 响应头 `Cache-Control: private, no-cache, no-store, max-age=0, must-revalidate`（本环境页面实际未带 86400s 共享缓存头，按实际行为记录）。
- `curl http://127.0.0.1:4322/api/public/contents/cachefix-target` → revision `3dc5ba82-cd9f-4612-8c3a-c90fc0f28752`，access=full，bodyMarkdown 含付费标记。
- `curl http://localhost:3102/render/3dc5ba82-cd9f-4612-8c3a-c90fc0f28752/cachefix-target` → 200，含付费标记（旧 revision 直达基线可访问）。
- DB 基线 updated_at = 2026-10-12 14:02:20.919+00。

### A2 SQL 模拟修复（PASS）

- `UPDATE contents SET visibility='paid' WHERE slug='cachefix-target'` → UPDATE 1；revision 与 updated_at 未变（纯 SQL 不触发应用层）。

### A3 cache refresh 原子轮换（PASS）

- `pnpm cli cache refresh cachefix-target` 输出：`cache 61f8bb9d-22d2-431d-b28c-a15c7270bb9c: verified` + `✓ cachefix-target revision rotated`。
- SQL 复查：revision `3dc5ba82…` → `0c439dc5-164d-4063-97c8-76b4d65931a2`（已变化）；updated_at 14:02:20.919 → 14:04:43.691（已更新）。
- cache_events 中事件 61f8bb9d state=verified、attempts=1（`pnpm cli cache status` 同步确认）。

### A4 收紧后匿名断言（全部 PASS）

| 断言 | 命令 | 实际结果 |
|---|---|---|
| canonical 仅预览 | `curl -H 'cache-control: no-cache' http://localhost:3102/p/cachefix-target` | 200，付费标记出现 **0** 次；含“公开段落一”与付费/预览提示 |
| 旧 revision 直达 404 | `curl http://localhost:3102/render/3dc5ba82…/cachefix-target` | **404**（middleware 门禁） |
| API 不泄露 | `curl http://127.0.0.1:4322/api/public/contents/cachefix-target` | revision=新值 `0c439dc5…`，access=preview，hasPaidContent=true，bodyMarkdown 长度 64 且**不含**付费标记 |
| 新 revision 直达仅预览 | `curl http://localhost:3102/render/0c439dc5…/cachefix-target` | 200，付费标记 **0** 次 |

页面 HTML 在 refresh 后立即反映新权限（revalidate 路径生效），未观察到陈旧缓存造成的权限窗口。

### A5 权限放松方向（PASS）

- `UPDATE contents SET visibility='public'` + `pnpm cli cache refresh cachefix-target` → 事件 48b44c70 verified。
- revision 再次轮换 → `79eb3f94-36cd-4f32-9966-1e26a47d6304`，updated_at → 14:05:31.293。
- 匿名 `/p/cachefix-target` 付费标记恢复 2 次（全文可见）；中间 revision `0c439dc5…` 直达 → 404；新 revision `79eb3f94…` 直达 → 200 含全文。

## 场景 B：重试耗尽事件不阻塞投递

### B1 构造死信（PASS）

- SQL INSERT 105 条 cache_events：state=failed、attempts=3、created_at = now()-2h 起逐秒递增，payload 为合法事件 JSON（tags=["feed"]、paths=["/"]）。
- **验收操作偏差与修正**：首次构造时 payload 内嵌 `id` 与行 id 不一致，导致首次 `cache retry` 时 web `/api/revalidate` → API `/api/cache/event` 返回 404（unknown event）→ 投递 HTTP 503，100 条 attempts 3→6 仍 failed。这是 fixture 构造错误（真实事件由 enqueueCacheEvent 保证行 id == payload id），非产品缺陷；已修正 payload 使内嵌 id == 行 id 并重置 attempts=3 后重新验收。该偏差本身也顺带验证了“未知事件不会被 web 端接受”的防护行为。

### B2–B3 死信不占满批次、新事件正常投递（PASS）

- 105 条死信（created_at 最旧，占满“最旧 100 条”批次位）存在的情况下：
- `pnpm cli cache refresh cachefix-target` → 新事件 `91725a9a-5109-4242-bebd-dc8d01b14246: verified`（attempts=1，无需人工干预）。
- DB 复查：105 条死信仍 state=failed、attempts=3，未被正常投递触碰；`pnpm cli cache status` 输出中新事件为 verified、死信保持 failed。

### B4 cache retry 有界恢复（PASS）

- 第 1 次 `pnpm cli cache retry`：恰好 **100** 条输出 verified（批次上限 100 生效），每条 attempts 3→4（单次运行每事件最多再试 3 次的上界内，实际 1 次即成功）；剩余 5 条仍 failed/attempts=3。
- 第 2 次 `pnpm cli cache retry`：剩余 **5** 条全部 verified（attempts→4）。
- 幂等：此前已 verified 的 4 条正常事件（含新事件 91725a9a）attempts 保持 1，未被 retry 重复投递（retry 查询仅选 state!=verified）。

### B5 边界：attempts=2 的失败事件（PASS）

- INSERT 1 条 state=failed、attempts=2 的事件（`839eca0a-e41a-4226-ab55-0244799f5ae6`，created_at 早于现在）+ `pnpm cli cache refresh cachefix-target` 新增 1 条新事件。
- 正常投递一次输出两条 verified：attempts=2 事件被再试且成功（attempts 2→3，恰好在 3 次上限边界）；新事件 20e6ae7c verified（attempts=1）。

## 最终环境状态（保留，未清理）

- contents.cachefix-target：public/published，revision `f97f13db-6a3b-4fb8-aa8d-2381077e5deb`（场景 B 的 refresh 又轮换数次），已恢复种子语义。
- cache_events：111 条全部 verified（105 条验收死信 + 1 条边界事件均已恢复，按要求未删除）。

## 证据文件（evidence/）

- `A1-api-public-full.json` / `A4-api-paid-preview.json`：API 响应元数据（bodyMarkdown 已脱敏为长度+标记存在性，不含付费正文）。
- `A1-page-public.html.grep`、`A4-page-paid.html.grep`、`A1-render-old.html.grep`、`A4-render-new-paid.html.grep`、`A5-page-public-restored.html.grep`：各 HTML 的字节数、付费标记出现次数、预览段落存在性（不含正文原文）。

## 未覆盖项 / 残余风险

1. 并发窗口（旧渲染跨越 refresh 完成后以旧 revision 重填缓存的竞态）未以并发时序复现，仅验证了其结果态防护：revision 轮换后旧 revision 直达 404、API 以当前 revision 应答，旧渲染即使完成也无法通过门禁。
2. tags/collections 关联路径（/tags/*、/c）的失效未单独造数据验证；投递流水线中该类路径的 catalog-version 校验逻辑未走到（本验收事件 paths 仅含 "/" 与内容页）。
3. 重试“每事件最多 3 次”的耗尽路径（投递持续失败时 attempts 递增到 3 后停止）未走到——修正 fixture 后首次投递即成功；B1 偏差阶段实际观察到 attempts 3→6 是 retry:true 每次运行再给 3 次机会的预期语义，不是超限。
4. CLI publish/unpublish 路径未覆盖（任务未要求）。
