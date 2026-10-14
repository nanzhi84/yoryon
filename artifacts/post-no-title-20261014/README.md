# 帖子去标题

目标：帖子列表和详情不显示标题与“未命名内容”，日期作为列表详情入口，长文保留标题；保留正文、展开、互动、置顶/付费标记。仅两个服务端组件改变，不涉及数据迁移或内容更新。设计与React检查见design.md。

实际执行：pnpm typecheck（typecheck.log）、git diff --check、独立隔离pnpm build（build.log，环境和命令见acceptance.md）。未增加固定测试程序。独立agent的本地HTTP范围及浏览器限制见acceptance.md。

源码提交见commit.txt；git push origin main见push.log。Vercel项目yoryon-web，team_QZe9hRamSsGyB0AEDzsHIb5v，project prj_xqDwJzlRrfdQA63FIMeIsRpReaRP。MCP project查询403，使用CLI相同team/project inspect成功，配置见project-inspect.txt。无凭据写入工件。

部署命令：vercel --prod --skip-domain --yes --scope team_QZe9hRamSsGyB0AEDzsHIb5v，回执deploy.log；git集成也会为同一main提交生成production deployment，后续检查生产域名实际指向。此前生产部署信息见previous-deployment.json，可通过vercel rollback使用该部署ID回滚。

生产候选部署 dpl_4FocscT3FdtzYrEGqYQXi8cHsaZy READY，使用 `vercel promote https://yoryon-gf70otjst-zyy2740738166-7111s-projects.vercel.app --yes --scope team_QZe9hRamSsGyB0AEDzsHIb5v` 成功切换域名，promote.log留存。production-deployment.json确认yoryon.com当时指向该READY production。主agent实际读取09.27帖子，h1为空、日期和末段仍正确。Git自动部署同一提交也在进行，git-deployment.json记录其状态。
