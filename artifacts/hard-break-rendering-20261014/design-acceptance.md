# 硬换行渲染修复：实现前独立失败方式与验收设计

2026-10-14，publication_acceptance 子 agent。此前p/br数量验收只证明结构，未证明CSS渲染行距；用户截图已证明出现双换行，之前不能据此宣称视觉通过。

业务契约：单个Markdown硬换行应只造成一次可见换行；空白段保持真正段落留白；不改原文、搜索节点id、UTF-16文本和偏移，也不改索引。

|失败方式/边界|现场行为核对|通过证据|
|---|---|---|
|br后的装饰span首newline与pre-wrap叠加|单个硬换行，中文及ASCII正文|只隐藏一个格式newline；可见两行之间无额外空白行，实际浏览器截图/行框位置|
|多个硬换行或连续br被一次吞掉|相邻硬换行、两次br、带多个开头newline的span|仅每个紧邻br的格式newline隐藏一次，其余真实内容/换行保留；变换重跑幂等|
|br后先跟strong/em/link等节点|硬换行后强调/链接、相邻嵌套装饰span|不得误删正文或漏修；若算法不匹配，明确该结构范围与真实输出|
|软换行被误隐藏|普通单换行文本，无br|pre-wrap既有可见行为不变，无新增hidden节点|
|代码与预格式被改|inline code、pre/code含newline、代码内br样节点边界|源码及代码文本完全不变，不能递归误改pre|
|真实空段被吞|NBSP p、空段与硬换行相邻|NBSP段落数量、位置、语义保持|
|搜索文本/偏移漂移|单节点及跨节点命中，中英混合、emoji UTF-16|修复前后每个data-search-node id/textContent逐字相同；TreeWalker SHOW_TEXT顺序和累计长度相同；跨hidden子节点offset定位文本一致|
|隐藏newline影响可访问性|hidden aria-hidden与可见正文|hidden只含格式newline，不包后文；正文仍可选/可读；真实浏览器搜索高亮及屏幕阅读未测则标UNVERIFIED|
|实际8条仍出现空白行|每条详情及首页预览，同原始行数组|p/br行序完整；真实浏览器逐行布局是最终视觉证据，结构补充不能冒充视觉|

执行约束：不新增固定测试程序或fixture。可用CLI临时内联React SSR对上述现场输入作结构行为验证，并保留命令/输出为工件；不向生产写数据。实现后复制最新源码到既有独立工作区，隔离preview.env、DB/API，NODE_ENV=production执行实际pnpm build。生产部署后GET普通域名核对实际8稿、节点textContent与隐藏newline。

浏览器检查：本次先调用cua.getState()，返回browsers=[]，只有本地应用列表。内置Browser当前没有可用表面；不把读取用户Chrome现有会话当成替代。将告知主agent寻找其主线程内置Browser能力；若仍不可用，视觉最终验收必须UNVERIFIED，不能单凭p/br或hidden结构通过。
