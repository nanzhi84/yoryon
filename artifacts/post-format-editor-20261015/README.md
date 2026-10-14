# 短帖格式整理页

用户入口：http://localhost:3118/tools/post-format
数据：只读分页核对线上公开 feed，共25条，其中16篇post；复制已有本地完整源稿，包括8月4日先前已确认的换行修正。
所有16篇编辑文件在仓库 `.local/post-format-editor/<slug>/index.md`；目录已加入gitignore。保存仅修改该本地副本，不写线上或当前预览数据库。后续发布需另行执行现有发布流程。

编辑：原文/信息流实际MarkdownSurface预览，搜索日期/正文，保存此篇/保存全部修改；未保存离开提示；错误和并发冲突保留输入。未配置 LOCAL_POST_EDITOR_DIR 时 page/API默认404。仅loopback host访问；写操作验证同源Origin。文件保存保留frontmatter，revision compare+独占锁+同目录rename避免并发覆盖和部分写入。

运行：environment.json记录buildWorkspace和私有envFile路径，不记录其内容。先 `pnpm typecheck`，再在buildWorkspace用隔离API环境执行 `pnpm build`。启动：在其apps/web目录，`NODE_ENV=production node --env-file=<envFile> node_modules/next/dist/bin/next start --hostname 127.0.0.1 -p 3118`。
用户稿件需持续保留；不能清理 `.local/post-format-editor`。常规3117预览仍运行。本轮无发布。

独立验收使用复制目录和3119，不能修改用户稿件。结果、实际命令及证据见acceptance/。
