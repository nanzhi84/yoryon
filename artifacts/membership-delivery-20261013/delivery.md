# Issue #15 交付前工程检查

初次工程检查源码：55fc3faab9d56348dd28d24060801772429778f6。已整合 main ab6e744 的评论与缓存权限修复；独立验收发现后续两项缺口，最新修复源码为17c09e45895646643bd2bad41830ee3bff7fedc5。下列初次检查与末尾修复回执分别保留，不把旧回执当作后续源码的验证。

环境：macOS，本地 Postgres 16 容器 `deploy-postgres-1` 的专用数据库 `yoryon_member_20261013`（127.0.0.1:54320），本地文件存储 `/tmp/yoryon-member-20261013/storage`。API http://127.0.0.1:4160、Web http://127.0.0.1:3160。隔离配置在 `/tmp/yoryon-member-20261013/env.sh`，不提交凭据。数据库从空库迁移到 0009，无生产数据写入或真实邮件。

独立验收阶段配置：Mailpit SMTP 11125、HTTP 11126；缓存刷新端点仅http://127.0.0.1:3160/api/revalidate，使用临时随机签名密钥；SITE_URL与API_PUBLIC_URL分别仅本地3160/4160。为现场真实注册超过20条问答验证分页，仅此隔离环境将RATE_LIMIT_SCALE升至100。验收数据由独立代理创建并清理，完成后删除临时配置、专用DB与文件存储；复跑须先重新准备对应隔离环境与安全配置。

实际命令与结果：

```text
source /tmp/yoryon-member-20261013/env.sh
pnpm db:migrate                       → migrations applied，exit 0
pnpm typecheck                        → exit 0，见 typecheck.txt
pnpm build                            → exit 0，见 build.txt
pnpm --filter @yoryon/api start        → api listening on :4160
pnpm --filter @yoryon/web exec next start -p 3160 → Ready
pnpm cli question list --status pending → exit 0，空库没有待回答问题
curl -sS -i http://127.0.0.1:4160/api/questions/public
  → 200，Cache-Control: private, no-store，{"items":[],"nextCursor":null}
curl -sS -i http://127.0.0.1:4160/api/me/profile
  → 401，private, no-store，{"error":{"code":"unauthorized","message":"需要登录"}}
```

PASS：静态类型检查、构建、新库完整迁移、CLI 入口可执行、空库公开问答 no-store、匿名自助资料拒绝认证。以上是工程检查，不能单独证明业务通过。

UNVERIFIED：会员并发额度、月界限、私密/历史回答、跨问答讨论/撤销/通知、头像真实上传与危险输入、头像GC、兑换 returnTo、首页置顶和合集逐篇权限、浏览器可见结果。主 agent 安排独立子 agent 现场执行并记录业务结果，发现失败后修复再核对最终版本。

部署前提：OSS API 身份需有 avatars/* 读写，CLI GC 身份需对 avatars/* 读/列举/删除；本次未更改生产 OSS 权限，尚未执行生产头像验收。

独立验收发现并修复：合集相邻作品 API 已返回 previous/next，但详情没有渲染。补充 CollectionNavigation，显示各所属合集的上一篇/下一篇与首末边界；链接只含公开元数据，目标正文继续通过详情权限判定。修复后重新执行 `pnpm typecheck`、`pnpm build`，均 exit 0（typecheck-navigation.txt、build-navigation.txt）；浏览器复验由独立验收代理记录。

第二项独立验收缺口：Hono挂载子路由会展平通配中间件，问答32KiB bodyLimit污染同/api下头像上传，166KB合法JPEG在API/BFF均被错误拒绝。现限制直接绑定提问POST/隐私PATCH，讨论写入仍有独立32KiB限制；头像保持2MiB。问答、资料、图片的no-store中间件均限定自身路径，身份中间件设置私有默认缓存头，以保留认证失败和不存在响应的no-store，不再依赖别的模块通配头。公开线仍跳过身份查询，公开字节路由保留原身份无关缓存策略。静态检查与构建回执见typecheck-avatar-boundary.txt、build-avatar-boundary.txt；真实图片上传、流式超限和最终可见结果交由独立代理复验并记录，不以工程检查替代。
