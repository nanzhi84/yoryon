# /api/tags 404：根因与修复（2026-10-13）

结论：**生产标签 API 与原失败 Preview 的相关用户路径 PASS**。不是整站新版生产发布验收。

## 根因证据

Vercel 前端已包含 `/explore`，该页面预渲染时请求 `/api/tags`。生产 API 仍运行 `c52e0a12b5ee69a0763ea2327faf7448c4a373cd`，Git 源码和实际容器 bundle 都只有 `/tags/:slug`，没有独立 `/tags` 总览路由；因此线上 Hono 返回 `not_found / 接口不存在`，Vercel 构建中止。health/feed/collections正常，故不能用容器 healthy 判断接口契约已满足。

修复前精确部署：镜像 `yoryon-api:c52e0a12b5ee69a0763ea2327faf7448c4a373cd`，旧镜像 digest `sha256:2eda6fe88ffb1fe7f9e9b2c6e217f5be0f239bb54793c58666e33b9dd5d6005b`。

根因属于前后端发布版本未对齐；当前 main 已有正确路由，不需要再修改前端路径或用空数据隐藏错误。

## 变更与版本

生产补丁源码 `8ac4c1a98f96653a218bdc78beb99a936e5c1078`，分支 `codex/tags-api-hotfix`，直接基于已运行的 c52e0a12。只回填当前 main 的标签总览查询和公共认证旁路：2个文件，14行新增、1行删除。公开数据与身份无关，不执行会话读取/续期；响应仅标签 slug/name/已发布作品计数，包含零计数标签，按计数降序、slug升序。

镜像 `yoryon-api:8ac4c1a98f96653a218bdc78beb99a936e5c1078`，linux/amd64；本机和服务器 image digest 均为 `sha256:a687b43f65c20962f647b5c7913848e82cbf573e7907a27ab7631d23339cd6da`，运行容器 OCI revision 标签与源码 SHA 一致。

仅替换 API 镜像，未运行迁移、未更新正文/权益、未修改密钥或Vercel环境配置。生产3篇内容的完整行集合指纹（排序后行JSON的MD5聚合）前后均为 `9ebd8dfa8fa33411d8a6e970619c6572`。该证据仅对本次 contents 行集合成立，不作为全部数据库表证明。

## 命令与回滚

在独立 worktree（父提交c52）执行实际 `pnpm install --frozen-lockfile`、`pnpm typecheck`：退出0。独立agent使用隔离数据库、配置及FS真实CLI发布/下架作品和API核对，详见 INDEPENDENT-REVIEW.md。

```sh
docker build --platform linux/amd64 -f deploy/Dockerfile.production \
 --label org.opencontainers.image.revision=8ac4c1a98f96653a218bdc78beb99a936e5c1078 \
 -t yoryon-api:8ac4c1a98f96653a218bdc78beb99a936e5c1078 .
docker save yoryon-api:8ac4c1a98f96653a218bdc78beb99a936e5c1078 | gzip -1 | \
 ssh admin@8.222.152.17 'gzip -d | sudo docker load'
```

构建成功，服务器load成功。切换前核对配置仍为已审查的c52镜像，备份 `/opt/yoryon/.env.tags-before-20261013`，只改 `.env` 的 YORYON_IMAGE，执行 `docker compose -f compose.neon.yml up -d --wait --wait-timeout 90 api`。部署脚本带ERR自动恢复旧镜像；通过运行容器内部真实 `/api/tags` 查询200后才解除回滚trap。实际回执 deployment-receipt.json。生产公网上再独立核对结果和只读SQL。

手动回滚：将该 YORYON_IMAGE 恢复为上述c52镜像，再执行相同up命令；旧镜像保留。回滚无需数据库还原。本次标签补丁可在未来完成 main 的整套API/迁移/Web协调发布后退役，不需将旧版本代码反向合并覆盖 main。

## Vercel与真实用户路径

原失败 Preview `dpl_EWZBSFw4XYLCNetfzb7ztqN9nRE3`（源码 `a85e220f4373a04e6fb252f2599fe1102a33ae3f`，原PR #25最终头）。API修复后原样重建，命令：

```sh
vercel --scope zyy2740738166-7111s-projects redeploy \
 dpl_EWZBSFw4XYLCNetfzb7ztqN9nRE3 --target preview --no-wait
vercel --scope zyy2740738166-7111s-projects inspect \
 dpl_2NLcjAgpiVwDSzQtG1ZmuyCoUnSY --logs
```

新部署 `dpl_2NLcjAgpiVwDSzQtG1ZmuyCoUnSY`：**READY**，目标Preview，未提升为生产前端。URL：https://yoryon-brq3edtyn-zyy2740738166-7111s-projects.vercel.app 。构建日志 vercel-build.txt 确认 source a85e220，完整静态生成/trace/部署完成。

Preview env pull 的API_INTERNAL_URL显示空是所有相关变量标为sensitive的拉取脱敏，不是实际配置为空。本轮未改这些变量；临时拉取文件已删除，不存入工件。

独立内置隐藏浏览器实际打开 /explore，看见 agents3、engineering3、cacheproof0；真实点击 agents 到 /tags/agents 看见3篇作品，返回点击cacheproof看见零作品空列表。没有复用或修改用户日常Chrome标签。

## 验收范围

- PASS：匿名、invalidBearer、invalidCookie返回一致标签目录，public,max-age=0,must-revalidate，无Set-Cookie；付费作品只参与计数、不回正文。
- PASS：隔离CLI发布及下架、零计数、稳定排序；生产公开计数与只读SQL一致。
- PASS：生产health/feed/标签详情回归；实际容器镜像/源码标签一致；contents集合指纹前后一致。
- PASS：同源码Preview恢复构建，浏览器目录→标签列表/零内容标签路径。
- UNVERIFIED：新版main其余搜索、会员问答、个人资料等生产功能；当前生产Web仍为既有版本，/explore生产页面未随本次补丁上线。不能将Preview READY称为整站新版本已上线。

隔离验收数据库、临时内容/FS及浏览器标签已清理；没有实际生产业务写入、真实邮件发送或新增固定测试程序。已有未跟踪工件保留。
