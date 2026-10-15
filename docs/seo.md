# SEO 元信息边界

SEO 只消费现有页面已取得的公开元信息。正文、视图、权限、请求次数和 API/数据库合同保持不变。

## 规范地址与收录

- `apps/web/lib/seo.ts` 统一组装绝对地址；`yoryon.com` 与 `www.yoryon.com` 的规范域名固定为 `https://yoryon.com`。本地隔离环境使用自己的 `SITE_URL` origin。
- 首页、帖子列表、合集列表/详情、标签列表/详情及文章分别声明自己的 canonical，忽略跟踪和站内导航参数。
- 搜索、登录、注册、重置密码、兑换、通知和个人资料页使用 `noindex, follow`。不在共享 layout 禁止收录，也不通过 robots 阻止爬虫读取这些页面的 noindex。
- 本次不改变域名/历史地址跳转规则，不改变内部渲染路由。

## 摘要与结构化数据

- description 通过已有 remark parser 转成单行纯文本，保留链接文字，移除 Markdown 格式、HTML、媒体及引用定义。只传入公开 description，缺失时回退到标题，不从正文生成摘要。
- 列表说明来自现有栏目用途；标签说明来自已取得的标签名。页面上的原始摘要仍由原组件渲染。
- `seo-structured.ts` 只从现有 ContentDetail/CollectionDetail 的标题、公开摘要、发布时间、可见性和合集目录生成结构化数据。禁止序列化 `bodyMarkdown`、私有权益、媒体签名地址或读取会员全文。
- 作者使用站点现有单作者身份 Yoryon。文章声明规范页面、作者及现有合集关联；合集声明 CollectionPage/ItemList，目录顺序与现有 items 一致。
- JSON-LD 输出转义 `<`，避免内容结束 script 元素；不增加网络请求。
- 纯 HTML 块摘要会被移除并回退到标题；当前站点不支持的 GFM 扩展不额外引入解析依赖。

## sitemap 时间语义

继续只请求现有 `/api/sitemap`，仅保留首页、帖子/合集/标签入口和已发布内容/合集的规范路径，去重并拒绝功能页、内部地址和跨域地址。不额外请求文章、标签或合集数据。

审查发现 `contents.updatedAt` 除发布外，也会因 `blog cache clear` 等缓存修复而推进；合集时间同样包含置顶等管理修改。它们无法稳定代表内容的实质修改时间。因此 sitemap 省略可选 `lastmod`，结构化数据也不使用这些字段生成 `dateModified`。保留真实 `datePublished`，不以构建时间、抓取时间或发布时间冒充修改时间。将来只有提供可核实的内容修改时间后才恢复这些字段。

验收按根 AGENTS.md 现场执行，工件见 `artifacts/seo-20261016/`；不维护固定测试套件。构建和 HTTP 成功仅为检查项，搜索引擎是否收录、选择哪个 canonical 及最终排名需在其重新抓取后另行观察。
