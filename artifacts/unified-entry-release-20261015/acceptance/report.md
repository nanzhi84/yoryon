# 统一入口生产发布独立验收

结论：**PASS（本次已有生产样本可验证的上线范围）；无已发现 FAIL。** 本报告同时列出因生产样本不足而保留的 UNVERIFIED，不能将该结论理解为所有媒体、权益、分页与故障场景均已在生产复验。

验收日期：2026-10-15，用户时区 Asia/Singapore。独立验收 agent 未参与本次代码实现、commit/push 或部署；仅执行公开 GET、在专用内置 @Browser 标签真实点击并观测页面，未创建内容/账号/权益，未发邮件、点赞或评论。正常浏览可能产生产品自身 analytics 事件。

## 版本与环境

- 目标源码：`a9880ef7f3ce4cd407ce1f96467f285c0686d8b6`；本地 HEAD 和 `origin/main` 回执相同，见上级目录 `origin-main.txt`、`push.txt`。
- Vercel：`dpl_HdAvHJMqg8nWETjXJP1BPoa3vbwE`，READY；`vercel-current.json` 的 `githubCommitSha` 与目标提交相同，`promote.log` 记录提升完成。主 agent 另外通过 `vercel inspect yoryon.com` 核对主域名指向该部署。本文的页面验收直接访问 `https://yoryon.com/`。
- API 部署回执：`yoryon-api:a9880ef`，镜像 digest `sha256:114d36aafd3c8166d369384346580bfddee73c59fd67febe9e9874515f7f1466`，healthy、0 restart，见上级目录 `api-deploy.txt`。公开 API 不返回源码提交，不能把内容 version 当作部署版本。
- 浏览器：专用内置 @Browser 标签；桌面 1280×720，手机 390×844、320×844。最终已重置 viewport 并关闭自身标签，见 `browser-cleanup-independent.json`。
- 生产样本：文章 9 篇，其中 4 篇有封面、5 篇缺图；帖子 16 条、均无媒体且 API `collapsed=false`；1 个合集、37 篇均为文章。发布前基线见 `baseline-inventory.json`，发布后独立结果见 `api-after-promotion-independent.json`。

部署专属 `.vercel.app` URL 的匿名 GET 会跳到 `vercel.com` 的 `Login – Vercel` 页面。HTTP 200 是登录页，不能当作应用验收或与主域名比对 buildId 的证据。该限制不影响已直接完成的主域名浏览器验收；独立验收 agent 没有执行登录或绕过保护。主 agent 另用已配置的 `vercel curl` 获得受保护部署的实际应用 HTML，保存在上级目录 `staged-home.html`、`staged-posts.html`、`staged-collections.html` 与 `staged-observations.json`；独立审查其中首页9篇、帖子16条与合集1个的分区结果与主域名实测一致。

## 实际结果

| 验证范围 | 结果 | 实际可观察证据 |
|---|---|---|
| 首页仅文章 | PASS | API 与真实页面均为 9 篇文章，slug 顺序与发布前混排列表的 article 分区完全一致，无丢失/重复。Vercel BFF `/api/pages/:version/feed/start` 与 API 一致。 |
| 首页封面与日期 | PASS | 全部入口都有封面或占位；桌面均 112×84、手机均 88×66（4:3），标题与封面同顶；日期在左侧文字下方、互动栏上方。4 张实际封面均加载成功。见 `home-independent-dom.json`、`home-mobile-independent-dom.json` 及首页截图。 |
| 导航与探索 | PASS | 首页→帖子→合集→订阅；真实点击各 tab 正确进入目标。320px 下导航宽度至少 44px、页面 scrollWidth=320；390px 同样无横向溢出。探索是 `chevron-down`，路径 `m6 9 6 6 6-6`。见 `home-320-independent-dom.json`。 |
| 独立帖子信息流 | PASS | `/posts` 16 条，API 类型全部 post、slug 顺序与基线 post 分区一致，BFF 同源数据一致；保留正文排版与日期、互动栏，无文章封面占位。没有改成文字摘要入口。 |
| 原地展开/收起 | PASS | 实际点击 `note-2026-09-09-1` 的“展开”，条目从 594px 增至 1050px，完整末段“真正值得观察的是……”出现；按钮 aria-expanded=true。点击“收起”后恢复 594px、aria-expanded=false。见 `posts-expand-independent.json` 和展开截图。该样本是已有全文的前端折叠，不是远端取全文样本。 |
| 帖子日期→详情→返回 | PASS | 从日期链接实际进入 `/p/note-2026-09-09-1`，等待全文末段可见，详情完整正文出现，再返回 `/posts`。见 `post-date-independent.json`、`post-detail-independent.jpg`。 |
| 合集入口统一 | PASS | 生产合集入口桌面112×84、手机88×66，封面最终加载成功；标题/简介/篇数/更新日期保留。见 `collections-independent-dom.json`、`collections-mobile-independent-dom.json`、`collections-320-independent-dom.json` 及截图。 |
| 合集目录只含文章 | PASS | API 37 篇均 article，全部 slug 与发布前目录相同；浏览器目录37个文章链接；真实点击第1篇进入 `AI PM实习Day 1` 详情，正文、下一篇及返回合集入口存在。见 `directory-independent-dom.json`、`chapter-independent-dom.json`。 |
| 公开图片真实字节 | PASS | 4 张文章封面和1张合集封面的原始媒体 SHA256 均等于对应公开 policy 内容哈希；主域名320档 WebP字节有效、无签名URL暴露于响应头。不能只凭200作此结论。见 `api-after-promotion-independent.json` 的 publicBytes。 |
| 匿名访问边界 | PASS（实际样本） | 无凭据 GET `/api/auth/me` 为401、private no-store。会员文章 `first-internship-day-18` 返回 access=preview、bodyCharacters=0、media=[]，private no-store；公开文章/帖子为full。未用登录或付费身份。 |
| 页面运行错误 | PASS（已执行页面） | `releaseTab.dev.logs({levels:['error','warn']})` 返回[]，见 `browser-independent-runtime.json`。工具宿主的 Statsig 网络日志属于 Codex 浏览器工具自身，不属于 yoryon 页面控制台。 |
| 发布后运行日志 | PASS（有限窗口回执） | 已审查主 agent 的上级目录 `runtime-observability.json`：API近20分钟日志扫描157条info、0error；Vercel近15分钟error级查询返回0行。日志窗口与查询上限不等于持续无故障保证。 |

## 未覆盖与结论边界

- **UNVERIFIED（生产）**：分类型第二页，因为文章9/帖子16均不足20、nextCursor=null。跨页无重复/顺序、返回已加载列表、旧/错类型游标等已有隔离验收，见 `../../unified-entry-20261015/acceptance/report.md`；发布后 API 错误游标回执另见 `api-after-backend.json`。
- **UNVERIFIED（生产）**：媒体帖在信息流直接展示、远端展开/重试/离页取消、付费帖子展开与权益媒体字节、文章详情音视频播放；本次未向生产增加样本。相关隔离实测见上述隔离报告及 `reproduction.md`。
- **UNVERIFIED（生产）**：含历史帖子关系的合集过滤/拒绝写入、缺封面合集实际数据、并发撤权/缓存TTL/真实通知邮件；生产合集已有37篇均article，不以这个结果冒充混合关系边界验收。
- **UNVERIFIED**：所有真实设备、跨浏览器/系统字体、屏幕阅读器、长时间运行和压力。手机结论是内置浏览器的明确viewport测试。
- **UNKNOWN**：未逐一人工重制历史封面构图；统一中心裁切为现有设计，生产合集原图是正方形，列表按4:3裁切，原图未改。

本次没有新增固定测试程序、合成 fixture 或生产测试钩子。工件包含公开内容及尺寸/哈希回执，不包含 cookie、token、签名 URL、邮件地址或用户标识。可复查操作见 `reproduction.md`。
