# 本地浏览体验修订

预览入口：<http://localhost:3015/>。本轮落实用户15条浏览标注，保持既有阅读宽度、头像、浅蓝品牌色和与页面融为一体的内容背景。生产未变更。

音频始终使用同一控件，第一次点击直接播放；图片放大仅居中图像，可Esc/点击空白关闭。文章、兑换、标签页左上角可返回；追加列表和滚动位置会恢复。空描述长文根据匿名可见正文生成摘要；付费内容只取公开预览。订阅分会员作品/会员问答两个tab。探索仅合集/标签，独立标签页不混入合集，移除关于我与全部探索。正文/合集/评论依靠留白衔接。搜索改独立页面，返回恢复查询、已加载分页和位置。账户按实际登录状态显示登录注册或资料退出；外观只有一个深浅色开关。

## 验证与证据

本轮设计与编码前失败边界在design.md；React检查在react-review.md。根工作区 `pnpm typecheck` 通过，回执typecheck-final.log；最终独立副本 `pnpm build` 通过，回执build-final.log。现有CSS ::highlight(search-hit)优化警告保留。独立agent的真实UI/API/SQL验收结论、失败修复与未覆盖项见acceptance.md和acceptance-*工件；这些行为结果与静态检查分开报告。

原始7篇演示内容保留供预览，验收临时创建普通用户、25篇公开文章与1篇带marker付费文章，以验证实际第二页和权限边界；结束清理自身数据并保留原先非本轮会话。运行环境只限隔离DB `yoryon_page_redesign_20261013`、API4115、Web3015与FS `/tmp/yoryon-page-redesign-m0NxxV/storage`。私密配置和临时密码不进入工件，未向真实用户发送邮件。

## 运行与复生成

源版本为 `b8e7098e941f80d899cd6483a9ce236732e5ddf6` 加当前未提交变更。before.patch记录本轮开始前已经存在的改动；implementation.patch为累计跟踪文件diff，新增源文件仍在仓库。source-manifest-final.json核对55个文件在源目录与最终预览副本中一致。环境与真实PID在environment.json；最终独立预览副本路径在preview-workspace-final.txt，不覆盖正在运行的旧构建。

静态检查（仓库根）：

```sh
pnpm typecheck
```

构建（先进入preview-workspace-final.txt记录的目录，复用本机已安装依赖）：

```sh
pnpm_config_verify_deps_before_run=false NODE_ENV=production node --env-file=/tmp/yoryon-page-redesign-m0NxxV/preview.env -e 'const r=require("node:child_process").spawnSync("pnpm",["build"],{stdio:"inherit"});process.exit(r.status ?? 1)'
```

Web启动（该副本apps/web目录，3015空闲时）：

```sh
NODE_ENV=production node --env-file=/tmp/yoryon-page-redesign-m0NxxV/preview.env /Users/yoryon/Projects/yoryon/apps/web/node_modules/next/dist/bin/next start -p 3015 -H 127.0.0.1
```

API4115沿用既有createDeps/createApp与@hono/node-server隔离实例，本轮API摘要模块首次升级时已重启。API与Web只绑定127.0.0.1；未停止其他本地服务。本轮无新增迁移、依赖或固定测试程序。真实数据前提、执行动作及清理依据在acceptance-plan.md、acceptance-premise.json及最终acceptance-commands.md。复生成必须重新创建一次性隔离内容与用户，不把已清理记录当作仍存在的前提。

搜索仍依当前Issue #23：未订阅可发现付费正文命中的文章级元数据，但没有付费snippet、offset、命中位置/数量或受限媒体URL。返回沿用原会话并重新核验当前身份/修订/权限，查询不进入URL、埋点或日志，正文命中不保存到sessionStorage。登录和退出清空搜索记忆。

最终独立验收：15条标注的可见交互PASS；分页信息流返回5763.5→5763.5、标签返回5290→5290、搜索返回3305→3305，正常返回的会话与搜索次数保持。原音频竞态已修复并复验，会员权益到期后正文snippet被重新授权移除。当前Browser未触发persisted=true，真实BFCache冻结分支UNVERIFIED，范围详见acceptance.md。临时26篇/用户/权益/自有搜索会话等已清理，原始7篇和原非本轮会话保留。

最终首页及文章截图：browser-home-final.png、browser-article-final.png。浏览器保留原先深色设置，阅读内容宽720px，临时文章0；实际页面回执browser-final.json。浅色可通过账户菜单同一开关切换。
