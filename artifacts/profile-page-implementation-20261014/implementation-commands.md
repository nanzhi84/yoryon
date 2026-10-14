# 本轮实现与本地预览回执

工作区：`/Users/yoryon/Projects/yoryon`；HEAD见`source.json`。在现有未提交设计工作上修改3个视图文件，保留其他变更。

## 静态检查

在根目录执行`pnpm build`，退出0，回执`build.log`。首次与build并发执行`pnpm typecheck`遇到Next生成类型的短暂缺失，回执`typecheck.log`保留。build结束后单独执行`pnpm typecheck`，退出0，最终回执`typecheck-final.log`。复现时按`pnpm build` → `pnpm typecheck`顺序执行，不并行。

## 本地运行

API继续使用已有隔离进程4115。停掉旧3015 Web后，在`apps/web`执行：

```sh
NODE_ENV=production node --env-file=/tmp/yoryon-page-redesign-m0NxxV/preview.env /Users/yoryon/Projects/yoryon/apps/web/node_modules/next/dist/bin/next start -p 3015 -H 127.0.0.1
```

配置文件须保持私有，包含本地隔离API、数据库及存储配置，不在工件中复制内容。当前Web PID与API PID见`environment.json`。不需要新备份；本轮没有部署、迁移或生产写入。

## 实际预览

根agent在独立localhost预览页签仅查看现有preview_test用户的个人资料，未改资料或登录状态。568×896真实截图为`preview-user-profile-568.png`；尺寸回执为`preview-geometry.json`。独立验收agent的临时用户截图是`preview-profile-568.png`，两者区分保留。

真实用户路径、断言、媒体字节和清理结果由独立验收agent在`acceptance.md`及`acceptance-commands.md`记录。验收不能由构建通过替代。工件重生成须使用独立临时账号，沿用现有隔离DB/API/存储并按记录精确清理自身数据；不要改preview_test。
