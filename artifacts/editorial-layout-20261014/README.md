# 书刊式排版本地预览

预览 http://localhost:3016/ ，文章 http://localhost:3016/p/hello-world 。四个生产源码文件变更：globals.css、首页、ContentView、FeedTimeline。保留品牌色、导航、权限与媒体行为，无新增依赖。React检查：沿用服务端组件与现有props，无新增hook、请求、客户端bundle或共享可变状态；样式通过内容类作用域隔离，长标题允许两行。参考来源 https://keyu-tian-sabotage.github.io/ ：实际HTML内联CSS与原生脚本，字体/660px/17px/1.85/20px/52px规则；不是截图推测。

版本和环境见 environment.json、implementation.patch。当前源码基线见version.txt。隔离数据使用既有本地预览数据库和存储，不创建内容，不写生产。当前短示例无法完整验证长文、长代码/URL、付费全文的所有观感，范围见独立acceptance.md。

静态检查：仓库根 `pnpm typecheck`，结果typecheck.log。
构建：environment.json workspace同级build-workspace中运行：

```sh
pnpm_config_verify_deps_before_run=false NODE_ENV=production node --env-file=/tmp/yoryon-page-redesign-m0NxxV/preview.env -e 'const r=require("node:child_process").spawnSync("pnpm",["build"],{stdio:"inherit"});process.exit(r.status ?? 1)'
```

build-final.log通过。初次build.log记录副本pnpm依赖自动校验要求TTY；后用现有依赖并关闭执行前重复依赖校验。构建副本与dev副本分开，避免共享.next。

预览复生成：将当前源码复制到environment.json记录的workspace（排除.git、artifacts、.next、node_modules、.env），复用根及apps/packages的node_modules软链接，工作目录为workspace/apps/web：

```sh
node --env-file=/tmp/yoryon-page-redesign-m0NxxV/preview.env /Users/yoryon/Projects/yoryon/apps/web/node_modules/next/dist/bin/next dev -p 3016 -H 127.0.0.1
```

前提：隔离API http://127.0.0.1:4115 可用、私有preview.env仍存在、3016空闲。环境文件不进入工件。旧3015保留，便于对比。本轮不新增固定测试脚本。
