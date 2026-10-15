# 合集预览反馈

业务目标：合集章节连读后顶部返回目录；同一目录展示免费与会员章节；呈现真实封面布局。

实现边界：ChapterBackButton 只负责导航视图，复用 ChapterContextProvider 的 API 校验结果与 flowId，不新增请求或授权判断。有效合集上下文直接跳目录，加载中禁用，失败可重试，无有效上下文继续使用原 BackButton。正文权限保持 API 决策。

数据环境：Web http://localhost:3000，API http://localhost:4116，隔离开发数据库 yoryon_page_redesign_20261013，本地 fs 存储。无生产写入。现有免费章节保持原样，新增 editorial-paid-example（marker 公开预览），关联 editorial-preview。示例与封面是用户要求的交付数据，保留供预览。

封面复用现有原创 landscape.svg，用 sharp 转为 1200×900 PNG，经正式 collection cover 路径关联 media_assets，非外链图片。源图 artifacts/editorial-samples-20261014/posts/editorial-visual/media/landscape.svg。

从仓库根目录重现数据操作：

```sh
node --env-file=/tmp/yoryon-local-preview-20261015.env --import tsx apps/cli/src/index.ts publish artifacts/collection-preview-feedback-20261015/paid-example
node --env-file=/tmp/yoryon-local-preview-20261015.env --import tsx apps/cli/src/index.ts collection cover editorial-preview artifacts/collection-preview-feedback-20261015/collection-cover.png
pnpm typecheck
```

实际回执：published editorial-paid-example，contentId 1da91427-b89e-4777-8c2c-1f12d99fa177；cover mediaId fb267650-8b78-47f2-9d36-c6403293af92。CLI 缓存事件由于本地未配置推送目标而 pending，页面实际可见状态由独立验收判断，不能据提交成功推断。

静态检查通过，见 typecheck.log。构建在临时工作副本执行 pnpm build，继承隔离 API 配置，关闭临时副本的自动依赖重装检查，避免扰动正在运行的预览；见 build.log。独立验收报告另存本目录。

最终构建结果：PASS。首次构建继承 NODE_ENV=development 导致 Next.js /_error 构建报 <Html> 错误；正式重跑设置 NODE_ENV=production 后全工作区 pnpm build 成功，静态页面17/17，Web/API/CLI均完成。临时副本构建未干扰本地 dev 服务。
