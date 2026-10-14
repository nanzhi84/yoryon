# 头像提示合并

将个人资料头像区域原先两个p合并为avatar-help的一段提示：`PNG、JPEG 或 WebP · 最大 2MB · 上传后自动保存`。用户指明的533宽度下应在同一行，保留原字体12px/行高20px和顶距8px，去掉人为段落换行及额外4px顶距。不改变上传/自动保存逻辑；更窄宽度允许文字自然换行。

在根工作区停止旧Web PID61659，执行`pnpm build`，退出0；之后顺序执行`pnpm typecheck`，退出0。回执分别是build.log/typecheck.log。使用既有私有隔离配置在apps/web启动`NODE_ENV=production node --env-file=/tmp/yoryon-page-redesign-m0NxxV/preview.env node_modules/next/dist/bin/next start -p 3015 -H 127.0.0.1`，新PID见environment.json。没有创建备份、部署或改变用户数据。

独立agent现场只读浏览器验收，结果与实际截图另存acceptance.md。构建与静态检查不能替代行数/布局的实际页面验证。
