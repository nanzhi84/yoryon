# Issue #14 / ff84d80 第五轮窄范围独立验收

**结论：A / B / C / D 均 PASS；自有数据清理 PASS。未发现本轮范围内阻断项。** 结论来自真实浏览器操作、写入完成后的独立 SQL、网络时序及最终可见结果，不以 HTTP200、构建成功或固定断言数量替代业务验收。

## 版本、环境和约束

- 冻结 commit：`ff84d8024b1a7c9acc68def07b7d78e3abc3777b`，分支 `feat/comments`（用户交付已 rebase 至含 PR2 的 main）。本轮起始和终态 tracked/staged 修改均为空。
- 现场开始：`2026-10-12T16:52:41Z`。macOS 27.0.1 / Node v24.20.0；指定 Playwright 1.64.0 / Chromium，headless，1200×900、zh-CN、`--host-resolver-rules=MAP localhost 127.0.0.1`。
- API `http://127.0.0.1:4323`；用户交付的最新完整构建生产模式 Web `http://localhost:3103`；PG 主机入口 `localhost:54329/yoryon_accept_comments`（SQL观察容器内部 `172.25.0.4:5432`）；SMTP / Mailpit `127.0.0.1:11125/11126`。
- 所有业务命令加载 `/tmp/yoryon-accept-comments/env.sh`，不打印环境。只访问这些隔离服务；不执行迁移（仅只读确认已有8条）、不停端口、不重启、不commit/push。
- 写请求经真实 `localhost:3103` BFF，Origin保持受信同源；浏览器通过真实登录表单、真实站点Link导航和真实同源logout，不改Cookie/CSRF机制。
- 只新增本工件目录；不改实现、不启动子代理、不新增固定测试程序/harness。现场操作直接 heredoc 执行，回执为非执行txt。方法与实际顺序见 [commands-r5.md](commands-r5.md)。

## 数据前提与清理边界

真实注册 → 本地自身验证码 → 验证的临时用户仅 `r5_reader` / `r5_actor`。r5_reader 用验证后的真实BFF会话经API新建一条根评论 `01de8571-a427-476d-a8ea-b7c0bffb822a`，正文 `r5-root-lifecycle-and-retry`，作品为既有已发布免费 `cmt-free`。随后真实Web登录。密码、验证码、token/Cookie、连接凭证仅在内存或0600 `/tmp`，不写入工件/截图/请求头日志。

显式SQL前置三条自有通知：`a5200000-0000-4000-8000-000000000001` 有链接，指向自己新根评论；末尾002/003的 content/comment 为null、link=null。B/C仅将这些自身通知重置未读；没有修改任何旧作品、旧评论、旧通知或旧权益。

旧库不是空库：已有2作品、48评论、44点赞、39通知、2权益、2兑换、2激活码、3旧用户。本轮自建评论在 cmt-free 39根中的初始第24位，因此D为了看到自有对象，实际点一次现有“加载更多评论”（20→39）；**没有**新增43行矩阵、逐页/旧游标矩阵或对旧评论互动。完整SQL前置回执在 `evidence/01-auth-precondition.txt`，排序位置查询在 `D-precondition.txt`。

## 短结果表与实际断言

| 路径 | 判定 | 实际结果 / 主要证据 |
|---|---|---|
| A read-all卸载/注销 | **PASS** | 真实POST route.fetch200；交付挂起时SQL三条read_at均非null。点Yoryon真实Link SPA到首页，文档内标记保留且document导航为空；真实logout200后auth/me401。放行原成功后1500ms无新增GET `/api/notifications`、无任何新增请求，URL仍`/`，首页目录DOM仍1、通知页标题0，SQL仍已读。`A-lifecycle-read-all.txt` / `A-home-after-logout-late-success.png`。 |
| B markRead卸载 | **PASS** | 重新真实Web登录；目标GET投影确实未读且link为`/p/cmt-free#comment-01de…`。真实PATCH route.fetch200；独立SQL已读后仍挂交付。真实Link SPA首页后才放行；1500ms网络无新增请求、URL仍首页、文章评论DOM0、文档标记保留，SQL已读。`B-lifecycle-mark-read.txt` / `B-home-after-late-PATCH.png`。 |
| C 挂载中正常守卫路径 | **PASS** | link=null通知真实PATCH200，列表未读点2→1、被点条目未读点0，SQL该条已读且另一条仍未读。正常read-all POST200后确实发起无cursor权威首页GET200；DOM未读点→0，三条SQL已读，read-all和条目按钮恢复enabled，留在通知页。`C-mounted-normal.txt` / 两张C图。 |
| D 评论旧失败提示清除 | **PASS** | 自己根评论真实PUT200且SQL own_like=1/like_count=1；随后根首页无cursorGET明确只注入一次503。泛化“点赞或列表刷新失败，请重试。”和独立“评论列表刷新失败。重试”均可见。点击后者内真实“重试”按钮，根首页/context/liked均真实GET200，无第二次PUT；成功后两旧提示均不存在，根首页恢复20条、分页按钮enabled，自身正文仍在、红心aria-pressed=true且点赞按钮enabled；回复、取消、未发送草稿输入/清空均可用。`D-comment-retry-clears-errors.txt` / 三张D图。 |
| 清理 / 旧行不变 | **PASS** | 精确自身范围删3通知、1点赞、1评论、2会话、2验证记录、2用户，所有自身残留0；仅删自己的2封Mailpit邮件，剩余自身邮件0；两秘密/tmp文件已删除。七类旧业务表完整有序行hash、旧用户非敏感列hash全部与开始相同。`cleanup-sql-mail.txt`。 |

### 时序证明与截图判断

- A原POST服务器写入在`16:57:49.025Z`已完成；route.fetch完成`49.027Z`，SPA首页且auth/me401核实在`49.086Z`，之后交付原成功响应。B原PATCH服务器写入`16:59:28.456Z`，route.fetch完成`28.459Z`，SPA首页后`28.506Z`才交付。均未依赖15秒超时，不用全页卸载掩盖旧async。
- 本工具没有调用Playwright `Response.json()`读取写响应。A/B/C通知写及D点赞只用方法/status、SQL和最终DOM核对；生产组件自己的正常JSON解析未改变。成功响应直接`route.fulfill({response})`，不合成成功body、不重发写入。
- 截图已逐一打开核对：A/B均确实是免费/付费作品信息流首页；C第一张仅002留红点，第二张列表无红点且按钮恢复；D失败图两行红色提示同时存在，恢复图两提示消失，最后图自身r5正文与红心1可见。截图无登录表单密码、验证码或凭证。
- C回执 `alerts:["通知 · Yoryon"]` 是Next路由播报节点，不是业务失败提示。
- 范围外可见现象明确保留：A注销后首页旧Bell入口仍可见；C列表已读后头部角标仍显示2。它们属于未修改的NotificationBell状态，不是本次列表生命周期/评论提示清除目标；**不**主张头部角标同步通过，A注销有效性由真实auth/me401而非图标证明。

## 静态旁证与失败记录

父流程提供的三份脱敏txt原样复制（敏感标记检查后）：

1. `typecheck-r5-build-race.txt`：第一次typecheck与build并行，build重建`.next/types`导致缺文件失败；原失败日志保留。
2. `build-r5.txt`：父流程完整`pnpm build`成功。
3. `typecheck-r5.txt`：完整build后父流程串行`pnpm typecheck`成功。

本轮未再跑typecheck/build；静态结果不是A-D通过依据。所有现场业务命令退出0；没有业务工具/服务故障、语法失败、写响应正文协议故障或写重发。只读源码定位曾读不存在的`site-nav.tsx`产生ENOENT（业务开展前），随后按实际`site-header.tsx`定位，未切换或重试业务机制。

## 清理与范围限制

- 清理为单事务精确UUID限定；没有通配UUID匹配，没有DELETE旧作品/权益/评论。清理前后完整SQL、回执和SHA256在`cleanup-sql-mail.txt`。七类业务表全行hash相同不仅依赖数量相等；旧用户只对 id/username/role/status/created_at/updated_at 比较，凭证不输出。
- D最后真实logout200/auth/me401；浏览器全部正常关闭；验证阶段留下的两会话由限定自身SQL清理。仅删除本轮自己的2封邮件，不清空Mailpit。`r5-private.json`和`r5-browser.json`已unlink，不删除父环境、旧报告或父日志。
- **未验证**：r2/r3/r4已完成矩阵、通知读取/分页响应卸载的其它排列、read-all后提交事务矩阵、旧评论游标全序、付费权益、头部Bell同步、全局认证UI刷新、15秒超时。均不扩大本轮结论。
- D重试后首页恢复20条且分页按钮enabled，自身评论已回到首页并完成可用UI验证；**没有再次点击重试后的下一页**，不把可用按钮状态夸称为全游标/全页验收。此前为定位自身对象的一次真实分页GET200有现场回执。
- A/B放行后各观察1500ms；本轮结论针对该真实成功响应触发的迟到续体，不覆盖其它长期定时行为。

## 收口与独立复核

实现diff及staged为空，仅有本工件目录未跟踪新增；最终安全检查见`evidence/final-safety-check.txt`。hash索引用相对工件路径，生成后不再改被索引文件：

```sh
cd artifacts/comments-accept-r5-20261012
shasum -a 256 -c SHA256SUMS.txt
```

本报告由独立验收角色判断，不替代父流程required reviewer门禁。建议父流程按本轮A-D回执、七张图及清理hash做窄范围复核后收口，不重跑历史矩阵。
