# Issue #15 交付前工程检查

源码版本：55fc3faab9d56348dd28d24060801772429778f6；后续提交仅添加本目录工件。依赖 Issue #14 的 70d6dd52，PR #20 合并后需整合 main，再由独立代理核对最终 head。

环境：macOS，本地 Postgres 16 容器 `deploy-postgres-1` 的专用数据库 `yoryon_member_20261013`（127.0.0.1:54320），本地文件存储 `/tmp/yoryon-member-20261013/storage`。API http://127.0.0.1:4160、Web http://127.0.0.1:3160。隔离配置在 `/tmp/yoryon-member-20261013/env.sh`，不提交凭据。数据库从空库迁移到 0009，无生产数据写入或真实邮件。

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
