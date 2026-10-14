# 已确认设计的本地页面

预览入口：<http://localhost:3015/>。按用户确认的三张生图稿实施，并按最新批注删除类型/tag在信息流中的展示、删除正文到继续阅读的分隔，仅保留继续阅读到评论的浅线。订阅按确认稿，问答空态下方无线。问答未知网络错误统一中文，受控API反馈保留。原始头像、真实媒体/正文、内容顺序沿用现有数据，不使用生成PNG作为网页资产。

## 实施

同一阅读栏保持max-w-3xl、左右24px；没有另外的App框架。信息流标题18/26、正文15/24、日期12/18、互动13/20px及17px图标，条内8–12px、条间40px留白加1px细线。类型标签不显示，tag仅在内容详情保留；付费状态仍可辨。音频同一控件44px高，一击播放行为不变。Feed图片取消Markdown默认额外上下margin。

详情标题28/38、正文16/28px；继续阅读上下篇两列，1px浅边框、同页面背景、10px圆角、14px内距、88px最小高度，首/末篇没有死链接；正文到此无分割，评论前保留1px浅线。订阅标题18/26、说明14/23、benefits12/20px，主tab44px；空态图标24px/文字14px，没有下线或围合底色。

## 环境与验证

环境见environment.json。Web只绑定127.0.0.1:3015，API保持127.0.0.1:4115；隔离DB `yoryon_page_redesign_20261013`，FS `/tmp/yoryon-page-redesign-m0NxxV/storage`。生产没有变更，本轮没有API/数据库迁移、数据模型或业务行为改动。秘密只在0600私密preview.env中，不复制到工件。

原始7篇演示用于页面验证。独立agent只对自己的专用Browser进行525×897尺寸调整、只读computed style与真实交互；临时网络阻断与尺寸覆盖结束恢复，自有记录只按所属ID清理。最终结论、实际操作与限制在acceptance.md及acceptance-*工件，未新建固定测试程序/单元测试。

根工作区 `pnpm typecheck` 最终通过，回执typecheck-final.log；第一次残余TYPE_LABEL在合集页的错误保留typecheck-first.log，已清除该视图引用。独立副本 `pnpm build` 最终通过，回执build-final.log。首次图集img继承30px上下margin问题及局部复验也保留真实回执，不用编译成功代替视觉验证。原有CSS ::highlight(search-hit)优化警告保留。

## 复生成命令

静态检查（仓库根）：

```sh
pnpm typecheck
```

最终构建（进入preview-workspace-final.txt记录的目录，现有依赖链接到仓库node_modules）：

```sh
pnpm_config_verify_deps_before_run=false NODE_ENV=production node --env-file=/tmp/yoryon-page-redesign-m0NxxV/preview.env -e 'const r=require("node:child_process").spawnSync("pnpm",["build"],{stdio:"inherit"});process.exit(r.status ?? 1)'
```

Web启动（同副本的apps/web目录，3015空闲时）：

```sh
NODE_ENV=production node --env-file=/tmp/yoryon-page-redesign-m0NxxV/preview.env /Users/yoryon/Projects/yoryon/apps/web/node_modules/next/dist/bin/next start -p 3015 -H 127.0.0.1
```

源版本为 b8e7098e941f80d899cd6483a9ce236732e5ddf6 加未提交改动；before.patch为本轮起始的已有改动，implementation.patch为累计diff。source-manifest-final.json记录59个文件含删除项，源目录与最新构建副本一致。本轮只替换此任务自己的Web预览进程，API与其他本地服务保留。React检查见react-review.md，编码前设计/失败边界见design.md。真实Browser路径与断言结果以独立验收报告为准。

最终独立验收PASS，实际525px页面与computed style证据见acceptance.md；两个真实问题修复并局部复验。最终截图acceptance-home-final-525.png、acceptance-article-final-525.png、acceptance-subscription-final-525.png。独立tab已恢复单tab尺寸/网络覆盖、关闭并清理自有34条匿名统计；主预览仅按自身独立sid清理9条统计，contents7/users0及其他统计记录保持，私密sid临时文件删除（root-preview-cleanup.json）。交付tab留在首页顶部供用户继续预览；未删除任何业务内容。

主预览清理运行：在apps/cli执行node --env-file=/tmp/yoryon-page-redesign-m0NxxV/preview.env --input-type=module的一次性stdin，读取本tab私密sid临时文件、检查current_database精确等于隔离库；repeatable read事务仅DELETE FROM analytics_events WHERE session_id=$1，校验contents/users/其他sid记录不变及本sid归零，再提交并移除私密文件。此记录不是固定测试程序。独立agent完整实际操作见acceptance-commands.md与acceptance-cleanup.md。
