# 硬换行渲染修复独立验收

2026-10-14，publication_acceptance子agent。实现前失败方式及边界在design-acceptance.md。本次修复补足此前只验p/br未覆盖的CSS双换行问题。

PASS（隔离构建）：复制新rehype-hard-breaks.ts与markdown-surface.tsx到既有独立源码工作区，preview.env连接隔离localhost DB yoryon_page_redesign_20261013/API4115。NODE_ENV=production运行项目 `pnpm --config.verify-deps-before-run=false build`，退出0；build.log。next start -p 4179实际服务文章响应留存local-article.html。未更改共享依赖或数据库。

PASS（现场SSR行为/结构）：临时内联CLI通过ReactDOMServer+ReactMarkdown执行单硬换行、连续两个硬换行、br后strong/link/inline code、软换行、pre代码、NBSP空段、emoji及8条真实稿；17个场景修复前后每个data-search-node id/textContent完全一致。硬换行后的隐藏节点仅含一个newline，hidden=""与aria-hidden="true"实际SSR属性正确。实际8稿隐藏newline数2/3/4/3/1/2/5/1，br不变；软换行、代码、NBSP输出不变。ssr-cases.jsonl和ssr-results.json保留实际HTML与结果，含UTF-16节点长度/累计偏移。不会因隐藏首newline改动原节点全文，因此既有搜索字符偏移保持；未声称CSS Highlight浏览器已通过。

PASS（边界）：再次应用变换输出相同，idempotence.json；手工现场HAST节点首文本为多个newline时仅第一个进入hidden，后续newline及emoji不变；pre内含类似结构也不修改，tree-boundaries.json。代码检查不改mapSearchText或数据库投影。

PASS（样式声明检查）：独立编译CSS含 `[hidden]:where(:not([hidden=until-found])){display:none!important}`；搜索span只有white-space:pre-wrap，pre为inherit，未发现项目规则覆盖hidden显示。此为样式结构证据，不等于真实浏览器像素结果。

UNVERIFIED：实际浏览器像素行框、窄屏自然折行、屏幕阅读与CSS Highlight选区。子agent主动getState返回browsers=[]，主agent也报告IAB超时和专用Chrome不可用。不可将p/br数量或hidden结构冒充“用户实际视觉已修复”。需要可用浏览器后补验真实8帖及跨节点高亮。

复核方式：仓库根目录用 `pnpm --config.verify-deps-before-run=false exec tsx -e '<现场React SSR表达式>'`，React与react-markdown从apps/web/package.json的createRequire解析，组件children为单/连续硬换行等Markdown，插件为rehypeSearchText与rehypeHardBreaks，renderToStaticMarkup保留HTML；已有JSONL保存每个输入场景输出。真实8稿从artifacts/post-linebreak-correction-20261014/posts读取。不新增可执行测试程序/fixture；生产最终证据待补充。

## 生产最终结构与样式证据

PASS：源码17f5250，主agent提供部署dpl_AeAcG44PnZwqPYPsSsRPwuRJVhiu。普通域名8条详情实际正文DOM：每篇仍1p，br数量2/3/4/3/1/2/5/1；各br附带格式newline只在hidden aria-hidden内部，每个hidden只含单个newline。排除hidden文本、按br计算的可见行数组逐项等原始manifest，节点ID与完整textContent和修复前生产响应逐字相同（所以既有UTF-16节点偏移仍成立）。日期/无标题不变。production-results.json与8份HTML留存。

PASS：生产首页实际首屏涉及的5条修正帖，排除hidden格式newline后的每行文本/顺序完整匹配源稿；production-home-lines.json留存。其他3条在后续分页，详情已覆盖，客户端追加实际视觉未测。首页日期仍ml-auto shrink-0，未命名标题占位无复现。普通域名真实加载CSS包含hidden display:none!important规则，production-ui-css.json及production-css-0.css留存。

以上是DOM可见文本模型与实际生产样式声明通过，绝不将其升级为像素视觉PASS：浏览器截图、行框测量、搜索高亮Range实际显示仍UNVERIFIED。未写生产数据、未修改索引或内容。独立4179服务完成后关闭。
