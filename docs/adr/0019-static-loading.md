# ADR-0019：静态站冷加载与文章预取

日期：2026-10-29。源码基线：`87bf15a`。目标：保持公开内容和交互契约，在固定冷缓存实验里让首页必需资源低于1秒，并缩短首次文章访问。

## 数据与模块边界

- 首页只下载展示所需的资源。页头使用既有小尺寸头像，原图路径保留；MarkdownSurface在构建时产出帖子DOM，PostEntry只管理展开状态。文章提示只跨客户端边界传slug、标题、日期，不再携带整条列表数据和不会出现的动态readerLayout。
- ReaderLink使用Next可见区域预取。仍由框架管理路由、并发与缓存；不自建全站抓取器、媒体缓存或API兼容路径。首次点击会消耗已经可用的预取数据，未完成时继续普通加载。
- 固定版本的`experimental.inlineCss`移除首次渲染的CSS往返。实验后保留：本站只有一份约49KB原始CSS。HTML与静态RSC会重复携带样式，gzip后仍有额外传输；React在导航时按href去重，验收要求始终只有一个实际样式表。框架升级必须复验；出现回归可删除该配置后重建。

## PERF-01：依赖故障回退修复

真实故障实验先于修复：阻断首篇文章`index.txt`预取，等失败后解除阻断，再点击文章。Next 15.5.27把异常捕获中的内部RSC URL作为整页导航目标，用户看到原始文本而非文章。证据：`artifacts/static-performance-20261029/acceptance/prefetch-failure-before-fix.json`与同名截图。

`fetchServerResponse`在export模式里修改局部URL并追加`index.txt`。该函数其他降级路径使用`doMpaNavigation`，它已经负责删除RSC标记与静态`.txt`后缀；只有catch分支绕过了这一既有转换。已核对官方15.5.28源码，同一问题仍存在，故不通过无效升级扩大变更。

采用pnpm原生patch机制，`patches/next@15.5.27.patch`只把CJS与ESM两个入口的catch返回对象改为`doMpaNavigation(url.toString())`。保留框架错误日志和单次浏览器回退，没有新增重试、全局fetch拦截或应用兼容层。补丁和精确版本被lockfile固定，冻结安装必须通过。

移除条件：后续Next版本的异常回退也经过相同URL规范化，并且真实浏览器故障实验通过；届时删除对应patch/配置并重新生成lockfile。验收需覆盖正常预取、未完成时立即点击、失败后恢复，以及查询参数/锚点保留。仅此依赖补丁回退会重新暴露已记录故障，不作为正常发布的独立回滚方案。

## 验证与发布边界

执行项目`pnpm typecheck`、`pnpm build`；使用真实快照、冻结基线产物和现场浏览器，记录原始Performance Timing、截图、正文可见结果。独立agent复核产物/媒体，并审阅主agent浏览器证据；不建立固定测试程序。公网基线与本地受控结果分开报告，生产发布后的时延、不同网络地区与长期尾延迟在本次本地实验中不作保证。
