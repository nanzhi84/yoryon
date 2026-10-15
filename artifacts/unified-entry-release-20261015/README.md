# 统一入口生产发布

结果：功能提交 a9880ef7f3ce4cd407ce1f96467f285c0686d8b6 已推送 origin/main，并部署 API 与 Vercel。生产地址 https://yoryon.com，部署 dpl_HdAvHJMqg8nWETjXJP1BPoa3vbwE，READY。Next.js 15.5.27；Vercel构建约56秒。机器可读回执见 deployment-receipt.json。

独立生产验收见 acceptance/report.md；实际浏览器截图与复查步骤同目录。已有生产样本可验范围PASS，无FAIL；生产分类型第二页、媒体帖和远端展开因无样本UNVERIFIED，不用隔离通过冒充生产覆盖。

## 发布顺序与实际命令

1. 按上一轮source-manifest核对已验收代码，扫描工件，精确暂存本次源码/说明/验收工件；原有docs/deploy-neon.md和grant-api-content-lock.sql等无关文件不进入提交。
2. `git commit -m 'feat: unify article covers and move posts to a dedicated tab'`，源码commit a9880ef。
3. `git archive HEAD` 导出干净发布源码；`docker build --platform linux/amd64 -f deploy/Dockerfile.production -t yoryon-api:a9880ef <export-dir>`。本机x64容器实际加载sharp/argon2并产出WebP，见native-probe.json；原生探针只证明镜像兼容，业务判断另看独立验收。
4. `docker save yoryon-api:a9880ef | gzip -1 | ssh admin@8.222.152.17 'gzip -d | sudo docker load'`；服务端镜像digest与本机一致。
5. 服务器保留旧镜像b0bdd76，并将仅含镜像tag的.env复制到 /opt/yoryon/releases/a9880ef/previous-image.env；设置新tag后执行 `sudo docker compose -f compose.neon.yml up -d --no-deps --wait --wait-timeout 90 api`，失败自动恢复旧tag。未覆盖Caddy/密钥配置，没有数据库迁移或业务数据更改。结果见api-deploy.txt。
6. API确认feed只article9、post-feed只post16后执行 `git push origin main`，用 `git ls-remote origin refs/heads/main` 核对远端，见push.txt/origin-main.txt。
7. Vercel当前链接项目yoryon-web（prj_xqDwJzlRrfdQA63FIMeIsRpReaRP），Owner zyy2740738166-7111s-projects，root apps/web；从干净导出目录创建生产部署：`vercel deploy --prod --skip-domain --yes --no-wait --meta githubCommitSha=a9880ef7f3ce4cd407ce1f96467f285c0686d8b6 --meta githubCommitRef=main --meta actor=codex`。未自动创建项目或改环境变量。
8. `vercel inspect <url> --format json` 和按githubCommitSha筛选的`vercel list`验证READY及源码；用 `vercel curl / --deployment <url>`（以及/posts、/c）检查受保护部署的实际应用。匿名专属URL的Vercel登录页不算应用结果，未关闭Deployment Protection。staged-observations.json记录分区技术检查。
9. `vercel promote yoryon-dvpybzfv4-zyy2740738166-7111s-projects.vercel.app --yes`，随后 `vercel inspect yoryon.com --format json` 匹配相同部署ID；独立agent直接在主域名执行浏览器、媒体字节与匿名权限验收。

## 验证与观测

上一轮pnpm typecheck、pnpm build及隔离用户路径PASS见 ../unified-entry-20261015/。本轮以完全相同源码commit构建发布，不重复生成测试程序。

API发布后近20分钟日志JSON扫描157条info、0 error；Vercel指定部署近15分钟error级查询0行（最多50行）。浏览器所走页面无warn/error。有限窗口不能替代长期运行保证。未修改Drains或创建监控自动化，Drains配置本次UNVERIFIED。

无业务/数据库迁移，故不新增数据库备份；保留原生产数据与服务配置。需要回滚时先将Vercel主域名重新promote到旧生产部署 yoryon-opknnvsy8-zyy2740738166-7111s-projects.vercel.app，再在服务器恢复previous-image.env并按同一compose命令启动API。旧tag及原配置保留，没有清理回滚资源。

## 工件与范围

部署状态/metadata、推送回执和native-probe均在本目录，独立报告/截图在acceptance/；CLI原始.log、受保护staged HTML和重建源码目录只作本地诊断，不作为固定测试入口。生产源码仍为a9880ef，后续只提交本发布证据不会改变应用代码或重新部署。
