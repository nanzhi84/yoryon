# 阅读性能优化验收

实现基线：288471a，当前工作区源码变更，未提交、未推送、未部署生产。完整输入源码 SHA256 见 source-manifest.json，变更文本见 source.diff，新图标字节与裁剪参数见 icons.json。

## 已实现

- 公开、无关联媒体且不超过4096 UTF-8字节的帖子随匿名列表传输许可全文，浏览器仍折叠到六块/32rem。展开不请求全文、不替换Markdown子树；长帖、媒体帖和付费帖继续按需核验、加载与错误重试。
- 文章标题/封面按阅读意图预热一次；点击即时显示“正在打开”。canonical页面每次经当前revision门禁，动态HTML/RSC禁止浏览器缓存，公开Data Cache按revision复用；不再通过静态rewrite导航修补重复请求。/render门禁与ISR保留，SEO/JSON-LD与正文共用ContentDocument。
- 滚动接近底部600px自动加载下一页，互斥/超时/卸载取消，错误暂停并允许重试，旧版本提示刷新，末页停止。保留各页正文与互动状态，新页不重新读取前页互动。
- 删除首页重复“阅读全文”链接；favicon/Apple图标使用当前页头头像，裁剪同50%/30%显示位置。
- 初始和分页Data Cache协议键更新为pin-v3，避免跨部署沿用旧服务器截断正文；旧浏览记忆字段兼容，仍只含公开列表。

## 检查与证据

- `pnpm typecheck`：PASS，typecheck.log。
- `pnpm build`：PASS，隔离源码/API/PG/FS，build.log与build-environment.json。
- 独立浏览器/CLI/API/SQL结论：acceptance/acceptance.md；实际命令、条件与回执：acceptance/commands.md。
- 主agent真实浏览器截图：expanded-post.png、article.png。内置Browser，751×896视口；截图不是示意图。
- 线上基线：09.27展开约279.9ms，文章标题→正文DOM约901.8ms；该两次单次观测主要为网络等待，未测到明显long task。production-baseline.json。不可把线上基线与隔离本地时延当同比收益，也没有测绘制时延。

## 环境与重现

隔离DB `yoryon_reading_performance_20261014`，Docker Postgres16 localhost:54320；API127.0.0.1:4117；Next生产构建localhost:3117；独立FS，Mailpit只接收本地邮件。环境文件私密、不在工件中，运行变量名和实际临时目录见acceptance/environment.json。输入来自当前真实公开稿件与媒体，经本项目CLI重新发布到隔离库；额外大帖/付费/三页分支只改隔离元信息，正文不伪造。

根工作区执行`pnpm typecheck`。复制当前apps/packages及根构建配置到临时工作区，按当前lockfile复用已安装依赖；Node `--env-file=<isolated env>`启动`pnpm build`，复制依赖链接引起pnpm路径状态差异，设置`pnpm_config_verify_deps_before_run=warn`避免对用户原node_modules触发安装/删除。构建成功后执行：

```sh
node --env-file=<isolated env> node_modules/next/dist/bin/next start --hostname 127.0.0.1 -p 3117
```

临时浏览器测量使用内置Browser的真实点击/滚动和本标签CDP事件；操作与回执见commands.md，无永久测试程序或合成fixture/harness。其他历史工件未删除或作为可执行测试入口。

## 发布与限制

本轮尚未发布。上线需要先更新API的匿名post投影，再部署Web(pin-v3)，在候选环境确认真实响应、展开/导航/自动分页、当前权限与最终像素，再切域名。无数据库结构迁移，无生产内容写入。API过渡到新DTO时旧Web仍有32rem高度限制，但六块裁切与无网络展开需要新版Web；不要只发布其中一端就宣称完成。

生产Vercel缓存/冷启动/真实用户设备/长期时延分布及Apple主屏安装：UNVERIFIED。本机DOM时间不代表绘制指标，不能宣称所有文章瞬开或给出生产改善百分比。已接收的公开正文、历史副本和已下载媒体不能远程召回。

最终验收：上述功能范围 PASS，pin-v3首屏/实际第二页也已通过（pin-v3-smoke.json），运行中的Data Cache实际URL已核对新协议。测试API、Web和自有Browser标签均停止/清理；本轮专用库、FS、测试账号/权益、私密env与凭据已删除，原有环境保留。清理回执 acceptance/cleanup.json、cleanup-verification.json。截图保留为可见结果证据，本轮临时预览URL已停止服务。

重建环境时从仓库`.env.example`生成新的0600配置，覆盖PORT=4117、DATABASE_URL指新独立库（54320）、API_INTERNAL_URL/API_PUBLIC_URL=http://127.0.0.1:4117、SITE_URL/ALLOWED_ORIGINS=http://localhost:3117、STORAGE_BACKEND=fs、FS_STORAGE_ROOT指新临时目录；BFF_SHARED_SECRET/FS_STORAGE_SIGNING_SECRET/CACHE_REVALIDATE_SECRET用新的随机值，绝不复用生产秘密。MAIL_SMTP_HOST/PORT保持本地Mailpit11025；只创建example.invalid的自有测试账号或使用本地Mailpit完成注册。依commands.md重发真实输入、授予测试权益与现场操作，结束只清理新库与新目录。无固定断言数要求，结果须再次按真实内容和最终可见状态独立判断。
