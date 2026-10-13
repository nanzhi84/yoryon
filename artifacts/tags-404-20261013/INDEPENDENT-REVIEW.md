# 独立验收（2026-10-13）

修复分支 `codex/tags-api-hotfix` 基于生产镜像 `c52e0a12b5ee69a0763ea2327faf7448c4a373cd`，只新增 GET /api/tags 和公开线认证旁路。两个文件独立 review：PASS，无阻断项。

修复前生产只读：health/feed/collections 200；tags 404 not_found；/explore 404。生产容器 healthy、镜像标签 c52e0a12；实际 `/app/dist/index.js` 含 `/tags/:slug` 字符串但不含 `/tags` 独立字符串。该提交源码同样没有目录路由。证据 `independent-before.json`。

隔离环境：本机 PostgreSQL 容器 deploy-postgres-1 的独立数据库 tags_hotfix_review_20261013，API 127.0.0.1:4193，临时媒体目录 /tmp/tags-hotfix-review-media，无SMTP发送、无生产数据修改。

现场命令：
```
docker exec deploy-postgres-1 createdb -U postgres tags_hotfix_review_20261013
DATABASE_URL=<isolated-database-url> node_modules/.bin/tsx packages/db/src/migrate-cli.ts
# 以下各命令使用相同隔离DATABASE_URL、BFF_SHARED_SECRET、FS_STORAGE_ROOT、FS_STORAGE_SIGNING_SECRET环境。
node_modules/.bin/tsx apps/api/src/index.ts # PORT=4193
node_modules/.bin/tsx apps/cli/src/index.ts publish /tmp/tags-hotfix-review-posts
curl -i http://127.0.0.1:4193/api/tags
curl -i -H 'Authorization: Bearer invalid-review' http://127.0.0.1:4193/api/tags
node_modules/.bin/tsx apps/cli/src/index.ts unpublish tags-review-three
curl -i http://127.0.0.1:4193/api/tags
```

数据前提：各目录 index.md 使用 frontmatter title/slug/type:article/visibility/tags。one 公开 tags=[alpha,zeta]；two 付费 tags=[zeta]；three 公开 tags=[zero]，正文“可见正文。”，无媒体。

PASS：真实CLI发布后目录返回 zeta=2、alpha=1、zero=1，按数量降序、同数slug升序。付费作品计入公开标签数量但不返回正文。
PASS：真实CLI下架three后zero=0保留，其他数量不变。
PASS：匿名、invalid Bearer、invalid Cookie返回相同完整JSON，public,max-age=0,must-revalidate，无Set-Cookie。最终回执 `independent-isolated.json`。
UNVERIFIED：此次局部API验收不覆盖前端浏览器；生产发布及Vercel preview验收由后续阶段补充。
UNKNOWN：隔离CLI缓存事件 pending(configuration missing)，此环境不验收生产缓存失效。

隔离数据库和临时媒体/内容目录验收后删除，API进程停止。没有新增固定测试或可执行验收程序。

## 生产切换后独立只读复核

PASS：公网 `/api/tags` 返回 agents=3、engineering=3、cacheproof=0；独立只读SQL查询生产published关联数逐项一致。
PASS：匿名、invalid Bearer、invalid Cookie完整JSON一致；均public,max-age=0,must-revalidate，无Set-Cookie。
PASS：/health、/api/feed、/api/tags/agents成功，agents详情有3个items；目录与详情数量相符。
回执：`independent-production-after.json`。

只读SQL通过SSH进入运行API容器执行 pg.Client，以容器process.env.DATABASE_URL建立连接，不打印连接凭据：
```sql
SELECT t.slug,t.name,count(c.id)::int AS count
FROM tags t
LEFT JOIN content_tags ct ON ct.tag_id=t.id
LEFT JOIN contents c ON c.id=ct.content_id AND c.status='published'
GROUP BY t.id,t.slug,t.name
ORDER BY count(c.id) DESC,t.slug;
```
结果 `[agents:3, engineering:3, cacheproof:0]`。

## Vercel Preview 浏览器验收

使用独立新建隐藏IAB tab（默认内置浏览器）。地址：
https://yoryon-brq3edtyn-zyy2740738166-7111s-projects.vercel.app/explore

PASS：探索页标题“探索”，合集入口与标签区可见，agents 3 / engineering 3 / cacheproof 0与生产API/SQL一致。
PASS：真实点击agents链接进入 `/tags/agents`，可见3篇作品：Jev 技术图解：从文本生成到类型化决策、深入 DeepSeek Harness：当 Agent Loop 也成为插件、从 Workflow 到 Agent：范式选择与构建模式。
PASS：浏览器返回目录后真实点击cacheproof链接进入 `/tags/cacheproof`，显示 #cacheproof、无作品，与零count相符。
没有Vercel保护登录阻断，没有修改生产Web或生产数据。
UNVERIFIED：新版整站其余功能、生产Web升级不属于本轮局部tags修复范围。
