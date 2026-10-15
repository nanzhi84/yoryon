# 独立生产只读验收

时间：2026-10-15 20:18:29–30 Asia/Singapore。主 agent 通知生产 API yoryon-api:b0bdd76 已部署健康后执行。

PASS：匿名访问生产 BFF `/api/contents/freedom-before-wealth/comments` 返回 `{"items":[],"total":0,"nextCursor":null}`。此前被删除且没有回复的根评论不再返回，计数同步为零。

PASS：匿名 `/api/contents/freedom-before-wealth/comments/context` 返回 `{"authenticated":false,"canInteract":false,"me":null}`，Cache-Control 为 `private, no-store`。公开列表响应为 `public, max-age=0, must-revalidate`；两次 Vercel 响应均 MISS/age:0。

结论依据为实际业务响应内容，不仅依据 HTTP 200。本 agent 只读请求，没有携带 Cookie/Authorization，没有修改任何生产数据。修复前匿名响应可与 artifacts/comment-visibility-20261015/production-anonymous-list.json 对照（deleted:true 且 total:1）。

实际命令（仓库根目录执行，可重复生成）：

```sh
curl -sS -D artifacts/comment-visibility-release-20261015/production-anonymous-list.headers https://yoryon.com/api/contents/freedom-before-wealth/comments -o artifacts/comment-visibility-release-20261015/production-anonymous-list.json
curl -sS -D artifacts/comment-visibility-release-20261015/production-anonymous-context.headers https://yoryon.com/api/contents/freedom-before-wealth/comments/context -o artifacts/comment-visibility-release-20261015/production-anonymous-context.json
```

UNVERIFIED（本 agent）：浏览器最终可见结果由主 agent 单独验证；生产双用户登录、生产授权写操作、直接后端域名独立访问。双用户越权删除与点赞隔离已在先前独占本地数据库及 API 验证 PASS，见 artifacts/comment-visibility-20261015/independent-acceptance.md。

UNKNOWN：现有已删除记录的来源。未据此声称确定是验收数据。
