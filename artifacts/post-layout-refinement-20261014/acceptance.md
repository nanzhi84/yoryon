# 帖子日期与八条单段内容独立验收

2026-10-14，publication_acceptance 子 agent。变更：仅首页post日期位置与明确指定8条正文人工换行；详情日期和article不变。

PASS：8条新稿与旧稿逐行移除行末Markdown硬换行空格、连接后逐字相同，未增标点或更改措辞；每条恰一行，frontmatter均保持。source-results.json记录逐条结果。输入基线为本会话已发布的旧稿；用户具体列文由主 agent核对。

PASS：独立临时工作区沿用artifacts/post-no-title-20261014/workspace-path.txt，复制最新feed-timeline.tsx。隔离env为/tmp/yoryon-page-redesign-m0NxxV/preview.env（DB localhost:54320/yoryon_page_redesign_20261013，API4115），未使用生产连接。执行 `set -a; source /tmp/yoryon-page-redesign-m0NxxV/preview.env; set +a; export NODE_ENV=production; pnpm --config.verify-deps-before-run=false build` 退出0，build.log。使用既有node_modules且禁止依赖状态检查触发安装，未更改共享依赖。

PASS：独立构建4179服务首页实际HTML中post日期link含ml-auto shrink-0、正确href和aria-label，无post标题；详情post无h1，article原h1仍存在。源码仅badge组移至日期之前、日期右推，article分支和详情不变；badge保留。local-results.json与local-*.html留存。构建成功只为静态/打包证据，实际用户内容另外验证。

PASS：线上8条内容发布后，实际正文data-search-content区域每条恰1个p、0个br，完整p文本逐字等manifest；16条原日期和无h1保持。其余8条帖子正文p文本、数量、br与上轮已验收生产HTML完全一致，未受本次内容更新影响。content-results.json和production-note-*.html留存。

UNVERIFIED：真实浏览器窄宽/主题像素布局、点击返回与展开。已知内置Browser不可用，依指令不反复试；ml-auto/shrink-0仅证明HTML布局声明，未宣称测得实际像素位置。

生产前端日期位置部署后验收待补充。

复核命令：curl -fsSL http://127.0.0.1:4179/、/p/demo-audio、/p/editorial-essay；线上 https://yoryon.com/p/<manifest-slug>，用Python标准库html.parser限制正文DOM统计p/br及完整文本。隔离服务启动命令 `pnpm --config.verify-deps-before-run=false --filter @yoryon/web exec next start -p 4179`，需先加载上述隔离env并NODE_ENV=production。未新增测试程序、fixture、生产写入或邮件。

## 最终生产前端

PASS：Git f145cad4ee6eae674acbaabfd10ba47554abe1a2，对应主agent提供dpl_DnAv2tga7UFvVWmHEuEMN5xx1XhJ。独立GET普通域名首页实际响应中，12个post日期link全部含ml-auto shrink-0，href与aria-label保持，日期前为空badge组（当前真实数据无badge），HTML顺序符合badge左、日期右。无帖子标题/未命名占位；首页article的所有h2逐项与上轮已验收生产HTML相同。production-home.html、production-ui-results.json留存。

本次八条单段与其余八条不变的生产结果见content-results.json；前端源码仅布局声明变更，实际像素右对齐仍未获浏览器视觉验证。没有新增数据或删除数据。
