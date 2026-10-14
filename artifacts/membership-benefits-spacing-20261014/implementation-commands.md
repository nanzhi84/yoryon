# 实际实现与预览命令

目录 /Users/yoryon/Projects/yoryon；HEAD 见 source-manifest.json。

1. Python tempfile + shutil.copytree 冻结源代码，排除 .git、node_modules、.next、artifacts、dist、*.tsbuildinfo、.env*、.storage、.vercel、__pycache__；各 workspace node_modules 软链到现有本地依赖，不安装依赖。
2. `pnpm typecheck > artifacts/membership-benefits-spacing-20261014/typecheck.log 2>&1`，exit 0。
3. 在 preview-workspace.txt 指定目录：

```sh
pnpm_config_verify_deps_before_run=false NODE_ENV=production node --env-file=/tmp/yoryon-page-redesign-m0NxxV/preview.env -e 'const r=require("node:child_process").spawnSync("pnpm",["build"],{stdio:"inherit"});process.exit(r.status ?? 1)'
```

exit 0。构建读取隔离 API 127.0.0.1:4115，不写生产。

4. 核对旧预览74556的 `ps -p 74556 -o command=` 为 next-server 后SIGTERM，保留冻结目录作回滚；在新 workspace/apps/web 执行：

```sh
NODE_ENV=production node --env-file=/tmp/yoryon-page-redesign-m0NxxV/preview.env /Users/yoryon/Projects/yoryon/apps/web/node_modules/next/dist/bin/next start -p 3015 -H 127.0.0.1
```

使用 subprocess.Popen/start_new_session，Web PID2866，API62175未重启；只绑定回环地址。首个立即发出的 readiness curl 为HTTP000（服务器未就绪），后续就绪回执见工具输出；不作为业务验收。

5. 本次 diff current-turn.patch 比较旧 frozen workspace 与工作源码，不覆盖之前 dirty work；source-manifest.json 核对所有68项累计修改/删除与新预览源码一致。

验收复现前提：隔离 API 和其 DB/存储已存在，保持相同现有演示数据；使用595×896独立@Browser页签走 acceptance-commands.md 所列路径。没有新建固定断言/合成 fixture。

6. Root在自己IAB tab2访问subscription→点击兑换→Back返回subscription。per-tab CDP Emulation用于595×896截图，完成后clearDeviceMetricsOverride，保留此页签作为交付。普通CUA screenshot在Emulation下出现缩放尺寸，最终PNG使用同一tab的Page.captureScreenshot（显式clip x0/y0/width595/height896/scale1、captureBeyondViewport=false）保留真实布局，没有修改截图像素。

7. Root匿名SID为null；清理脚本的SID guard拒绝执行（missing_own_anonymous_sid），未连接/修改数据库。核对仅访问的订阅/兑换无AnalyticsListProvider/DetailTracker后，删除0600临时SID文件，不创建SID、不按时间或其他会话扩大删除。见root-preview-cleanup.json。独立验收agent的现场访问清理另有回执。

8. 独立发现图集尺寸漂移后按design.md补充边界修正两个图片视图文件；重新冻结至/var/folders/d_/8w6ff22d7gn6r0vr84g21d5r0000gn/T/yoryon-membership-spacing-final-0kbjtb8b/workspace，执行同样pnpm typecheck / pnpm build均exit0，回执typecheck-final.log/build-final.log。核对2866为next-server并仅停止该本地预览，以相同命令启动最终Web PID11163，API62175保持。之前预览目录保留。
