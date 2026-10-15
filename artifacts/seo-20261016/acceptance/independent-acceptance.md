# SEO 独立审查与验收

时间：2026-10-16，Asia/Singapore。验收 agent 独立判断；未修改实现源码、未新增可执行验收程序或固定测试套件。

## 实施前失败方式与边界

- canonical 缺失、重复、带查询参数、错误域名或错误编码，导致不同页面互相指向或列表分页失去规范地址。
- 功能页没有 noindex，或由共享 layout 继承到文章/合集等应收录页面。
- description 残留 Markdown/HTML/实体，或误改可见文案、标题、正文；空摘要产生无意义值；会员正文通过摘要泄露。
- JSON-LD 无法解析、脚本闭合注入、作者或关联地址不实、合集目录顺序/权限信息错误，或新增数据请求/读取受限正文。
- sitemap 包含草稿、私有地址、功能地址、重复或跨域地址，时间被生成时刻替代，或为了 SEO 改变页面/API 请求链路。
- 仅凭 HTTP 200、构建或静态检查不能判定最终可见结果和权限正确。

## 环境与数据前提

- 实施前本地 Git HEAD：`20c1bd31d5d2abc09d1b0fc5c66bbd9c362b00d0`。既有工作区有其他改动与工件，本次验收未改动它们。
- 公开生产基线：匿名只读 `https://yoryon.com`，未登录、未写生产、未发送邮件。
- 本次隔离库：本机 Docker PostgreSQL 16，`127.0.0.1:54320/yoryon_seo_20261016`；仅从既有隔离库 `yoryon_page_redesign_20261013` 克隆，无生产数据库连接。
- API：`http://127.0.0.1:4116`；Web 计划 `http://localhost:3216`。独立 fs 存储 `/tmp/yoryon-seo-20261016/storage` 由已有隔离存储复制。
- 临时配置 `/tmp/yoryon-seo-20261016/acceptance.env`，权限 0600，不进入工件/仓库。SMTP 指向 `127.0.0.1:1`，无法发送真实邮件。
- 配置和存储是临时验收材料。API 使用现有 `createApp`/`createDeps` 启动；启动时校验数据库名为专用隔离库。

## 实际命令与实施前回执

```sh
git rev-parse HEAD
docker exec deploy-postgres-1 createdb -U postgres yoryon_seo_20261016
docker exec deploy-postgres-1 pg_dump -U postgres --no-owner --no-acl yoryon_page_redesign_20261013 | docker exec -i deploy-postgres-1 psql -U postgres -d yoryon_seo_20261016 -v ON_ERROR_STOP=1
curl -fsS http://127.0.0.1:4116/api/sitemap -o artifacts/seo-20261016/acceptance/isolated-api-sitemap.json
curl -fsS http://127.0.0.1:4116/api/collections -o artifacts/seo-20261016/acceptance/isolated-api-collections.json
curl -fsS http://127.0.0.1:4116/api/tags -o artifacts/seo-20261016/acceptance/isolated-api-tags.json
```

命令 exit code 均为 0。隔离源数据含现有公开/会员文章、合集和标签；API 原始匿名回执均保留在上述 JSON。文章/合集的 title、description 只留 hash 与状态/时间于 `isolated-contents-before.tsv`、`isolated-collections-before.tsv`，不保存用户/凭证数据。

公开基线使用 Python 标准库 `urllib.request` 并发匿名 GET 下列地址，保存原始 HTML/XML/txt，再由 `HTMLParser` 提取元信息、JSON-LD、main 可见文字/链接/媒体及 hash 到 `baseline-summary.json`。可逐条复现，例如：

```sh
curl -fsS 'https://yoryon.com/' -o artifacts/seo-20261016/acceptance/baseline-home.html
curl -fsS 'https://yoryon.com/c/first-internship-diary' -o artifacts/seo-20261016/acceptance/baseline-c_first-internship-diary.html
curl -fsS 'https://yoryon.com/p/deepseek-harness' -o artifacts/seo-20261016/acceptance/baseline-p_deepseek-harness.html
curl -fsS 'https://yoryon.com/search?q=agents' -o artifacts/seo-20261016/acceptance/baseline-search_q-agents.html
curl -fsS 'https://yoryon.com/sitemap.xml' -o artifacts/seo-20261016/acceptance/baseline-sitemap.xml.xml
```

全部 16 个基线路径取得 HTTP 200：`/`、`/posts`、`/c`、`/c/first-internship-diary`、`/tags`、`/tags/agents`、`/p/deepseek-harness`、`/search?q=agents`、`/login`、`/register`、`/reset-password`、`/redeem`、`/notifications`、`/settings/profile`、`/sitemap.xml`、`/robots.txt`。该状态仅表示取得响应，不作业务通过结论。

现场观察：指定列表/合集/标签页 canonical 均缺；指定功能页 robots/noindex 均缺；抽查文章已有规范地址 `https://yoryon.com/p/deepseek-harness` 与 1 份 JSON-LD。

## 浏览器限制

独立子代理执行 `cua.createBrowserTab("iab", "https://yoryon.com/", {visible:true})` 明确返回 `IAB visibility is not supported in a subagent thread`。省略 visible 再试，30 秒超时并 reset。独立子代理浏览器视觉为 UNVERIFIED；已通知主 agent 负责真实 Browser 的最终页面核对，后续将其证据与本代理独立 HTML/API/SQL 结果区分。

## 实现后验收

独立阅读本次源码差异和新增 `lib/seo.ts`、`lib/seo-structured.ts`、`components/structured-data.tsx`。页面视图函数除添加无可见内容的 JSON-LD script 外没有调整；API、权限、公开正文读取、fetch helper 与页面数据获取代码没有改动。所有新增结构化数据函数均为已有 DTO 的同步映射，没有 fetch、数据库或存储依赖。单作者身份取站点既有 Yoryon 名称和首页，不添加未证实的个人资料。

隔离 Web 实际在 3216 运行。使用匿名 Python 标准库 HTTP 获取 25 条路径，保留原始 HTML/XML/txt 和 `isolated-summary.json`；随后人工核对元信息、JSON-LD、DTO 及 SQL，结果保存 `isolated-contract-review.json`。复现请求示例：

```sh
curl -fsS 'http://localhost:3216/?utm_source=seo'
curl -fsS 'http://localhost:3216/posts?utm_source=seo'
curl -fsS 'http://localhost:3216/c/editorial-preview?utm_source=seo'
curl -fsS 'http://localhost:3216/tags/layout-preview?utm_source=seo'
curl -fsS 'http://localhost:3216/p/editorial-paid-example?collection=editorial-preview&utm_source=seo'
curl -fsS 'http://localhost:3216/sitemap.xml'
```

### 已验证结果

- PASS：首页、帖子列表、合集列表/详情、标签列表/详情均只有一个 canonical，指向隔离站自身对应路径，UTM/collection 查询参数不进入规范地址；正常内容页未被 noindex 污染。
- PASS：搜索、登录、注册、重置密码、兑换、通知、个人资料均实际输出 `noindex, follow`；robots 仍允许页面被抓取以读取 noindex。
- PASS：各列表页面 description 各自对应现有公开用途；真实生产合集摘要的粗体与换行可正确清理。现有空 description 的 `/p/hello-world` 实际以已有标题“测试文章”作为摘要，没有派生正文。
- PASS：文章与合集 JSON-LD 均可 JSON.parse，含真实站点作者及规范地址；文章关联到已有合集；合集 8 个目录项的标题、顺序、URL 和免费/会员标识逐项等于已有公开 DTO，没有读取章节正文。
- PASS：现有匿名 paid API 和合集 API 的 before/after JSON 逐字段一致；付费文章仍 `access=preview`，schema `isAccessibleForFree=false`，无 `articleBody`、`bodyMarkdown`、`text` 字段。
- PASS：CLI 临时调用现有 metadata 函数处理标题、粗体、链接、代码、引文、列表、实体、空白；JSON-LD 临时含 `<script>` 的字符串输出无原始 `<`，JSON.parse 可恢复原文。回执 `metadata-runtime-probes.json`，未保存可执行探查程序。
- PASS：隔离 clone 与原隔离库所有 15 个作品的正文/预览/title/description hash、状态、权限和时间均相同；before/after 文章、合集元信息 TSV 也完全相同。只保留 hash，没有保存受限全文。
- PASS（首次实现，作为发现依据）：sitemap 的 17 个动态路径逐项等于匿名 API 与 SQL 的发布内容/合集，URL 无重复、无功能页；当时 17 项 XML 时间与 SQL 相同。`sql-sitemap-times.json` 与 `isolated-contract-review.json` 保留这一阶段的回执。此后因更新时间语义审查而省略所有 lastmod，最终结果以 `final-isolated-summary.json` 为准。
- PASS（有界观察）：排空隔离 API 日志后单独请求合集，实际只观察到 1 次合集 DTO GET；单独请求已缓存付费文章，只观察到 1 次公开 revision-policy gate GET，没有逐章额外请求。仅保留 method/path/status/duration 于 `request-observation.json`，不含会话/请求 ID。结合源码证明新增 schema 不引入请求；未声称冷缓存性能或完整浏览器网络比较。

### 更新时间审查与修正要求

代码审查确认：发布写作品与受影响合集的 updatedAt；删除/撤回更新受影响合集并失效 sitemap；合集元数据、封面、排序也维护时间。上述写路径没有在本次重复发布执行，结论来自当前源码，实际生产发布/删除流程保持 UNVERIFIED。

同时确认既有 `apps/cli/src/commands/cache.ts` 的 cache clear 仅轮换 revision 也会更新作品 updatedAt；`collection pin/unpin` 会更新合集 updatedAt，但其缓存事件没有 sitemap。数据库记录更新时间不能稳定等价于页面实质修改时间。本次若宣称“sitemap 更新时间已校准”，不能仅以 XML 等于数据库判定通过。

独立建议：动态项暂不输出不能保证语义的 lastmod；保留同一 API 请求、正式域名、路径过滤及去重，不扩大到 API/DB/业务缓存修复。Google 官方要求 lastmod 与页面最后一次实质更新稳定、可核实地一致；该字段为可选。[Google sitemap 文档](https://developers.google.com/search/docs/crawling-indexing/sitemaps/build-sitemap)

主 agent 已按建议修正并完成重新构建，最终隔离 3216 服务已重启。独立再次匿名读取首页、帖子、合集详情、标签详情、公开文章、付费文章、登录页、sitemap、robots 共 9 个路径，原始回执为 `final-isolated-*`，汇总为 `final-isolated-summary.json`。

- PASS：最终 sitemap 保持 4 个固定入口与 17 个已发布内容/合集地址，所有项均省略 lastmod，没有以记录更新时间/构建时间/发布时间代替。
- PASS：最终公开/付费文章与合集 JSON-LD 不再含粗粒度 dateModified；OG 不含 article:modified_time；文章真实 datePublished 保留。
- PASS：规范地址、文章/合集关联、作者、权限标记、公开摘要保持；最终 6 个直接可比 HTML 样本的 main 可见文字相同。付费页最初 final 探查少带 collection 参数，因此合集导航文字不同；按原相同参数重取后可见文字也完全相同，回执 `final-isolated-paid-content-comparison.json`。
- PASS：独立最终源码审查和 `git diff --check`，无阻断发现；本次不修改 API/DB/业务缓存机制。

**本地验收结论：SEO HTML/API/SQL PASS；真实浏览器视觉/交互 UNVERIFIED。** 主 agent 报告最终 `pnpm typecheck`、`pnpm build` 均 PASS，它们是静态/构建检查，不计作浏览器业务通过。

### 当前明确边界

- UNVERIFIED：独立真实浏览器最终视觉与交互，原因见浏览器限制；HTML main 内容不等于浏览器渲染结果。
- UNVERIFIED：搜索引擎实际重新抓取/索引与排名、Rich Results 展示、真实会员登录后的完整页面、生产发布/删除写路径。
- 既有 `/p/不存在`、`/c/不存在` 仍可能返回流式 HTTP 200 + noindex；本次不改变状态码/路由链路。标签不存在实际返回 404 + noindex。
- description 清理器针对现有 CommonMark；纯 HTML 块会整体去除并回退标题，GFM `~~删除线~~` 原样保留。当前实际公开摘要未发现此语法，不作为本次阻断。
- 未执行畸形 sitemap 响应、跨域路径或重复 API 项的模拟；对应过滤/去重由独立源码审查确认，未构造固定 fixture/harness。

## 生产部署后验收

主 agent 提交并推送 `052a9ee34cf3b801ed7da4b60c5021536ed79259`，暂存部署 `dpl_6VMUXN5jSQUa32yxvbRkPZTyno9J` READY 并 promote 后，本代理从正式域名重新独立执行匿名 GET。提交/远端/部署身份由主 agent 留回执，本代理独立核对的是正式站实际返回行为。

共 22 个正式域名 HTML/robots/sitemap 路径，另读取 4 个公开 API 回执和 www 标签页。原始文件为 `production-*`，提取结果 `production-summary.json`，逐项核对 `production-contract-review.json`，内容比较 `production-visible-comparison.json`。没有生产业务写入、没有登录、没有发送邮件、没有读取会员全文。

复现命令：

```sh
curl -fsS 'https://yoryon.com/?utm_source=seo'
curl -fsS 'https://yoryon.com/posts?utm_source=seo'
curl -fsS 'https://yoryon.com/c/first-internship-diary?utm_source=seo'
curl -fsS 'https://yoryon.com/tags/agents?utm_source=seo'
curl -fsS 'https://yoryon.com/p/deepseek-harness?utm_source=seo'
curl -fsS 'https://yoryon.com/p/first-internship-day-42'
curl -fsS 'https://yoryon.com/sitemap.xml'
curl -fsS 'https://api.yoryon.com/api/sitemap'
curl -fsS 'https://yoryon.com/api/collections/first-internship-diary'
curl -fsS 'https://yoryon.com/api/contents/first-internship-day-42'
curl -fsS 'https://yoryon.com/api/contents/deepseek-harness'
curl -fsS 'https://www.yoryon.com/tags/agents?utm_source=seo'
```

搜索、登录、注册、重置密码、兑换、通知、资料页分别 GET `/search?q=agents`、`/login`、`/register`、`/reset-password`、`/redeem`、`/notifications`、`/settings/profile`。全部请求取得响应；通过结论来自下面的实际语义核对，不以状态码代替。

- PASS：首页、帖子、合集、标签及其详情 canonical 均为 `https://yoryon.com` 对应干净地址；五类 UTM 样本均去参数；www 标签响应仍 200，但 canonical 正确指向无 www 正式地址。未改变 www 重定向行为。
- PASS：指定 7 类功能页均输出 `noindex, follow`；正常公开页面未继承 noindex；robots 仍只禁止 `/api/`，sitemap 指向正式地址。
- PASS：合集 SEO 摘要移除原有 `**` 和换行；原始公开 DTO 摘要逐字保持。公开文章 description 与 schema description 一致。
- PASS：公开文章 Article 有作者 Yoryon、mainEntityOfPage 和真实发布时间；免费标识 true。会员 Day42 仍 paid/preview、匿名 bodyMarkdown 长度 0，schema 免费标识 false、关联实习合集，无正文字段；发布时间与 API 相同。最终 schema 不含粗粒度 dateModified。
- PASS：正式合集 37 个章节，与上线前匿名 DTO 完全一致，仍 15 full / 22 preview。CollectionPage/ItemList 的 37 个标题、规范链接、顺序和免费标识逐项匹配现有目录，没有逐章读取受限正文。
- PASS：正式 sitemap 共 67 个唯一 URL，全部正式 HTTPS 域名；地址集合恰等于真实 API 63 个动态地址加 4 个固定入口，无漏项/多项/重复；所有 lastmod 均省略，未出现功能页、跨域地址或内部渲染路由。
- PASS：上线前后 15 个相同路径样本的 HTML main 可见文字、链接与媒体 src/srcset/alt/poster 提取值完全一致，包含首页、帖子、合集列表/详情、标签列表/详情、公开文章、会员文章及功能页。这是服务端 HTML 对比，不代替浏览器视觉。

**生产验收结论：SEO HTML/API PASS；本地 SQL 与独立源码审查 PASS；真实浏览器视觉/交互 UNVERIFIED。** 未发现阻断问题。索引、排名和搜索引擎最终 canonical 选择仍需其后续实际抓取结果，未在本次声称通过。

## 隔离资源清理

保留回执后已完成清理。先用 lsof/ps 精确核对 4116 的本次 API PID 89396 及其专用 env/database 参数，再执行：

```sh
kill -TERM 89396
docker exec deploy-postgres-1 dropdb -U postgres yoryon_seo_20261016
```

随后仅删除 `/tmp/yoryon-seo-20261016` 和本次数据库导入日志。独立复查 4116 无监听、专用库不存在、临时根目录不存在；原 `yoryon_page_redesign_20261013` 库与其 storage 仍在。主 agent 已停止本次 3216 Web。回执 `cleanup-receipt.json`。

再次复现隔离验收时需先按本文克隆原隔离库、复制其 fs 存储，并重新生成权限 0600 的临时配置；API/Web 使用同一个新生成的 BFF 随机值，fs 签名随机值不少于 16 字节。数据库/端口/site/storage/禁用 SMTP 参数与本文一致，配置不得进入工件。公开生产只读检查可直接重复本文 curl 命令。

本次未创建生产业务数据、未发送邮件，未清理源隔离环境或其他进程。
