# 生产发布验收

日期：2026-10-15（Asia/Singapore）。发布提交 b0bdd76，已推送 origin/main。

构建来自 `git archive b0bdd76` 的干净导出目录，不包含工作区其他改动。生产 API 与前版 db24e8c10d3cc46fda7fe5c6a71b102bfac841f0 相比只有 comment-read.ts 变化，无迁移，无生产业务数据写入。

实际命令：

```sh
pnpm typecheck
git push origin main
docker build --platform linux/amd64 -f deploy/Dockerfile.production -t yoryon-api:b0bdd76 .
docker save yoryon-api:b0bdd76 | gzip -1 | ssh admin@8.222.152.17 'gzip -d | sudo docker load'
```

服务器 `/opt/yoryon/.env` 原值留存 `.env.pre-comment-b0bdd76`，切换为 `YORYON_IMAGE=yoryon-api:b0bdd76` 后执行 `sudo docker compose -f compose.neon.yml up -d --wait --wait-timeout 120 --no-deps api`。结果 healthy。服务器原生 sharp 0.34.5 加载成功，argon2 hash/verify 成功，见 native-runtime.log。

PASS：内置浏览器现有文章标签页 reload，等评论加载后读取 `#comments` 可见文字为「评论 / 登录 后参与评论 / 还没有评论。」；错误计数（1）与删除占位均消失。截图 browser-after.png、文字 browser-comments.txt。重现：打开 https://yoryon.com/p/freedom-before-wealth ，刷新并滚动至评论区。

PASS：独立匿名生产接口验收见 independent-production-acceptance.md。已存在隔离双用户写入与分页验收，见 ../comment-visibility-20261015/independent-acceptance.md；本轮生产不创建测试评论。生产登录双用户写路径未重测。

回滚：服务器将 `.env` 恢复为 `.env.pre-comment-b0bdd76` 内容，执行相同 compose up 命令；旧镜像保留。无需回滚数据库。
