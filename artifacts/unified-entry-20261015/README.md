# 统一入口实现与验收

最终范围：首页仅文章且每条有4:3封面/占位；帖子独立到/posts，完整保留原信息流媒体与展开/收起；合集仅含文章目录与入口。导航为首页、帖子、合集、订阅，探索向下。

- 代码基线与最终文件哈希：source-manifest.json。
- 本次变更冻结：change.patch，不包含工作区原有的docs/deploy-neon.md等无关变更。
- `pnpm typecheck`：PASS，typecheck.log。
- `pnpm build`：PASS，build.log。为隔离现有3000开发服务的.next，在临时源码副本执行完整命令，绑定隔离API4215，不使用生产API或配置。
- 独立浏览器/API/CLI/SQL/媒体验收：acceptance/report.md；复现与数据前提见acceptance/reproduction.md、acceptance/environment.md。
- 实际可见结果：acceptance/home-desktop-final.jpg、home-mobile.jpg、collections-desktop.jpg、collections-mobile.jpg、posts-desktop.jpg。
- 本次没有部署、没有迁移/更改生产数据、没有新增固定测试套件。

实际最终构建命令（临时路径/配置在清理后需按复现文档重建）：

```sh
pnpm typecheck
pnpm_config_verify_deps_before_run=false NODE_ENV=production node --env-file=/tmp/yoryon-unified-entry-20261015/acceptance.env -e 'const {spawnSync}=require("node:child_process"); const r=spawnSync("pnpm",["build"],{cwd:"/tmp/yoryon-unified-entry-20261015/workspace",stdio:"inherit",env:process.env});process.exit(r.status??1)'
```

初次隔离构建误用验收配置的NODE_ENV=development，在Next /404生成阶段报 `<Html> should not be imported outside of pages/_document`；明确使用production环境后完整构建通过。最终日志为修复环境后的实际回执。源码保留原PostEntry、MarkdownSurface、post-feed、globals.css四个核心帖子媒体路径，哈希与基线一致。

UNVERIFIED：离页取消的底层传输abort回执；UI无晚到更新已验证。生产发布、生产缓存TTL与外部真实媒体/所有设备不在本次隔离验收范围；其余详见独立报告。
