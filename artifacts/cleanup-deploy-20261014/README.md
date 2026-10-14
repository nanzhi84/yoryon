# 清理与生产发布 2026-10-14

发布源：ce35856b3cb1f794439dea7e986c6f55e8462b33，GitHub main 实时 API 核对。无新增应用代码提交。前端 Git 自动部署 dpl_HZSKUJSBifHGFtq5tjPSHfxTmKDF 已 READY 且 yoryon.com/www.yoryon.com 指向此部署，来源 SHA 见 web-provenance.json。

## 清理

原工作区 clean。唯一额外工作树 favicon-avatar 无 tracked/untracked 改动，ignored 仅 node_modules、构建缓存及 .vercel/project.json。三个旧分支的独有提交以本地和 GitHub archive/20261014/{favicon-avatar,literal-search,tags-api-hotfix} 标签保留后移除分支与工作树。favicon 图标不在 main，未擅自合入。refs-before.txt/worktrees-before.txt/archive-tags.txt 与 after 工件保留可复核 SHA。git fetch 遇直连 TLS 错误，远端状态通过 gh api 实时验证。

实际命令：git tag archive/20261014/<name> codex/<name>；gh api --method POST repos/nanzhi84/yoryon/git/refs -f ref=refs/tags/archive/20261014/<name> -f sha=<原tip>；git worktree remove <worktrees-before路径>；git branch -D <三个分支>；gh api --method DELETE repos/nanzhi84/yoryon/git/refs/heads/codex/<name>；git update-ref -d refs/remotes/origin/codex/<name>；git worktree prune。

## 构建、备份与发布

环境：macOS ARM workstation，Docker Engine29.5.2；目标linux/amd64；生产单实例Ubuntu24.04，/opt/yoryon，Neon生产DB，私有OSS。秘密仅受保护的既有服务器配置。未发送邮件、未创建验收用户或作品。

pnpm typecheck 退出0，见typecheck.log。前端 Vercel正式构建READY。API正式Docker构建退出0，见api-build.log。没有把以上静态结果视作业务通过；独立浏览器验收见acceptance.md。

生产备份：sudo /opt/yoryon/backup-neon.sh；/var/backups/yoryon/20261014T075850Z/{database.sql.gz,media.tar.gz,SHA256SUMS,COMPLETE}。备份含生产数据，仅留服务器受保护位置，不复制到工件。backup-receipt.log记录OSS16对象及完成回执。

命令（仓库根）：

```sh
docker build --platform linux/amd64 -f deploy/Dockerfile.production -t yoryon-api:ce35856b3cb1f794439dea7e986c6f55e8462b33 .
docker save yoryon-api:ce35856b3cb1f794439dea7e986c6f55e8462b33 | gzip -1 | ssh admin@8.222.152.17 'gzip -d | sudo docker load'
ssh admin@8.222.152.17 'cd /opt/yoryon && sudo env YORYON_IMAGE=yoryon-api:ce35856b3cb1f794439dea7e986c6f55e8462b33 docker compose -f compose.neon.yml run --rm migrate'
```

正式迁移入口补齐既有未部署的评论、问答、引用、搜索和点赞迁移，重建3篇搜索投影。最小范围显式DML授权新表，未授权schema所有权或迁移备份读取，见permissions.log。生产不是隔离行为测试环境；只做已授权部署、派生索引回填和只读验收。

首版镜像启动FAIL：native ARM构建阶段没有安装sharp linux-x64。立即恢复.env.pre-ce35856对应旧镜像8ac4c1a，健康恢复；回执rollback-receipt.log。未回滚新增数据库表。

同源镜像追加锁文件版本@img/sharp-linux-x64@0.34.5与@img/sharp-libvips-linux-x64@1.2.4；可重复生成Dockerfile.amd64留在本目录，没有修改应用代码。npm --force仅用于下载显式x64包到ARM构建阶段，禁用安装脚本。目标x64实际WebP转换66bytes和argon2 hash/verify通过，见native-runtime.log。普通Dockerfile的跨架构可选依赖缺陷仍需后续修正，当前发布有可重建工件。

```sh
docker build --platform linux/amd64 -f artifacts/cleanup-deploy-20261014/Dockerfile.amd64 -t yoryon-api:ce35856b3cb1f794439dea7e986c6f55e8462b33-amd64 .
docker save yoryon-api:ce35856b3cb1f794439dea7e986c6f55e8462b33-amd64 | gzip -1 | ssh admin@8.222.152.17 'gzip -d | sudo docker load'
# /opt/yoryon/.env 指定上面的 -amd64 镜像，docker compose -f compose.neon.yml up -d --wait api
```

过程中出现另一会话的页面修改与editorial-layout工件，保持原样，没有纳入本发布。生产匿名验收不涵盖真实会员写入、邮件或所有用户并发状态。

最终发布镜像：yoryon-api:ce35856b3cb1f794439dea7e986c6f55e8462b33-amd64，远端不可变镜像ID sha256:dd7de527e8c241d610ee47e51c59120e6e681319aee7ac827239114409c613e1。api-rollout-final.log：Healthy，production-api-state.txt留最终状态。

错误观察：15分钟Vercel扫描发现1条首页catalog policy API502，发生于首版镜像启动失败期间；见frontend-errors.log。修正后短窗口另扫frontend-errors-final.log。旧API回滚仅用于应急，不构成新版功能可用。最终生产浏览器恢复结果以独立acceptance.md为准。

复验：新建内置Browser匿名标签进入https://yoryon.com，查看首页互动信息、搜索Jev并打开结果、正文与评论区域、/subscription与/tags；不要发送评论/点赞/邮件，不记录cookie或私密内容。本轮生产无会员账户写入测试，不能据此声称付费权益、真实点赞写入或邮件已验收。

最终结论：清理PASS；生产匿名真实路径PASS（原失败搜索重试恢复、结果全文、评论空态、首页三篇互动、匿名点赞登录限制、订阅/标签路径），详见独立acceptance.md。生产无付费内容，付费泄漏边界UNVERIFIED；登录、会员授权及点赞/评论业务写入、邮件/购买UNVERIFIED。修正上线后2分钟Vercel错误扫描无日志，此短窗口不代表长期无错误。
