# 当前独立现场命令回执

所有入口在独立 worktree，数据库/配置前提见 README；`.env` 必须用新的独立本地值，不使用生产配置。

```sh
git worktree add --detach /tmp/yoryon-cache-review-20261013 a84ce7d6c377db8fad6ddb579557b8b4e8a2c670
pnpm install --frozen-lockfile
docker run -d --name yoryon-cache-review-pg-20261013 --env-file .review-pg.env -p 127.0.0.1:55449:5432 postgres:16
pnpm db:migrate
pnpm typecheck
node --import tsx --env-file=.env apps/api/src/index.ts
set -a
source .env
set +a
pnpm build
# apps/web 目录：
node --env-file=../../.env node_modules/next/dist/bin/next start -p 3149
# worktree 根：
node --env-file=.env apps/cli/dist/index.js publish /tmp/yoryon-cache-review-posts
node --env-file=.env apps/cli/dist/index.js content pin review-14
```

临时 Markdown 数据由内联 Node fs 创建，24 个目录含 index.md。frontmatter：title="Synthetic cache review review-NN"，slug=review-NN，visibility=public，preview.mode=full，tags=[review-tag]，published_at=2026-10-01T12:00:00.000Z；正文 REVIEW_VISIBLE_N、独立 `<!-- more -->`、REVIEW_RESTRICTED_N。只用于此次 CLI 发布，在收尾时删除。

浏览器实际调用（内置 IAB；子 agent 不支持 visible:true，改为 visible:false）：

```js
var reviewTab = await cua.createBrowserTab('iab','http://localhost:3149',{visible:false});
// 保持此旧页面，另运行上述 pin CLI 后：
await reviewTab.playwright.getByRole('button',{name:'加载更多',exact:true}).click();
await reviewTab.getAXState();
await reviewTab.playwright.getByRole('button',{name:'刷新列表',exact:true}).click();
await reviewTab.getAXState();
await reviewTab.playwright.getByRole('button',{name:'加载更多',exact:true}).click();
await reviewTab.getAXState();
await reviewTab.goto('http://localhost:3149/p/review-00');
await reviewTab.getAXState();
```

SQL 无事件权限撤销（先请求 /api/public/contents/review-00 记录旧 revision，canonical GET 两次确认实际全文标记）：

```sql
SELECT count(*)::int n FROM cache_events;
UPDATE contents SET visibility='paid',preview_mode='marker',revision=gen_random_uuid(),updated_at=now()
WHERE slug='review-00' RETURNING revision;
SELECT count(*)::int n FROM cache_events;
```

随后实际 GET：`/render/<旧revision>/review-00`、`/p/review-00`、`http://127.0.0.1:4449/api/public/contents/review-00`，记录 HTTP/cache-control 及正文标记布尔值到 sql-revocation.json；不是仅检查退出码或 HTTP 200。内联 Node 从 packages/db 的 manifest 解析现有 pg 依赖：

```js
import {createRequire} from 'node:module';
const pg=createRequire(new URL('./packages/db/package.json',import.meta.url))('pg');
const client=new pg.Client({connectionString:process.env.DATABASE_URL});
await client.connect();
```

分页复核独立 SQL：

```sql
SELECT id,slug FROM contents WHERE status='published'
ORDER BY is_pinned DESC,date_trunc('milliseconds',coalesce(published_at,created_at)) DESC,id DESC;
```

实际 API 从 `/api/feed` 首屏取 version/cursor，后续 URL 带 `?version=<version>&cursor=<cursor>`，最多5次且 nextCursor=null 即停止；把全部 API IDs 与上述独立 SQL IDs 逐项比较，记录实际顺序、unique 数和各页终止状态到 pagination.json。旧 version `4fdf26fb-93d8-4b0c-837b-22869e0c5b9c` GET /api/feed 返回409。

API 单独退出：预先获取 review-04 当前 revision；GET /p/review-04 两次确认全文；`lsof -nP -iTCP:4449 -sTCP:LISTEN` 确认本次 node PID=27117；`kill -TERM 27117`。保留 Next 后 GET canonical、当前 render 和 `/api/pages/<当前version>/feed/<当前cursor>`，记录状态/耗时/cache-control/正文布尔值到 api-exit.json。Browser 对 /p/review-04 导航受 ERR_BLOCKED_BY_CLIENT 阻止，未计浏览器错误页通过。

数据清理仅作用于本次独占空库：

```sh
docker exec yoryon-cache-review-pg-20261013 psql -U postgres -d yoryon_cache_review -Atc "SELECT 'before_cleanup', (SELECT count(*) FROM contents), (SELECT count(*) FROM cache_events), (SELECT count(*) FROM users); DELETE FROM contents WHERE slug LIKE 'review-%'; DELETE FROM tags WHERE slug='review-tag'; DELETE FROM cache_events; SELECT 'after_cleanup', (SELECT count(*) FROM contents), (SELECT count(*) FROM cache_events), (SELECT count(*) FROM users);"
```
