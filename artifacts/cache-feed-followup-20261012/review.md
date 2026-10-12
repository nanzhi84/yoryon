# 独立审查（2026-10-12）

审查者：独立 review agent；不负责业务实现。基准 main `696ba1597fe88e702f48ae6c86fdd13c57bd95da`，审查提交 `f166cc6ad419df1dc4b3844e5e29d1cd64c3e1d5` 相对 main 的补充修复差异及新增 `apps/web/lib/public-catalog.ts`。已阅读根 AGENTS.md、GitHub Issue #10/#13 原文及原只读复核报告。仓库 `.agents/skills` 不存在，`/workspace/.agents` 为空，无可适用的本地 SKILL.md。

## 源码结论

PASS（源码审查，非端到端）：当前差异未发现需要阻断交付的确定正确性问题。

- `apps/api/src/public-policy.ts:35-44`：正文状态与 UUID revision 直接读当前数据库；API 失败沿现有 middleware catch 返回 503，未回退旧内存权限。发布状态消失则 404；事件缺配置、未投递或耗尽不再阻止正文撤销。图片策略仍依赖原事件目录，本轮没有将其误称为已修复。
- `apps/web/middleware.ts:27-41`：旧 `/render/<revision>/<slug>` 在缓存前受相同门禁约束；canonical 改写到新 UUID key。因此旧渲染晚完成只填旧 key，后续新请求无法重新获准旧 key。已获准的在途响应本身不会被取消，不应将本修复描述为在途请求撤回。
- `apps/api/src/routes/contents.ts:95` 与 tag handler：policy.version 和分页记录使用同一 repeatable-read 只读事务；避免版本读取与数据读取之间提交导致混合快照。版本使用事件 createdAt/id 最大值，正确性依赖受支持 CLI 写路径持统一发布 advisory lock 后再开事务；已核查 publish、pin/unpin、refresh、unpublish/delete。任意绕锁 SQL 写入不是此版本协议的支持路径；SQL 权限修复仍需执行 cache refresh。
- `apps/web/lib/public-catalog.ts:4-15`：每次渲染实时读取 catalog，再按 `protocol=pin-v2&version=...` 取共享数据；旧无协议两字段 Feed 缓存键不复用，版本竞态返回 409 时最多重试三次。首页/tag 变为动态渲染，保留 Data Cache；不再承诺首页 Full Route Cache 命中。旧客户端已有游标仍依赖既有 LoadMore 400/409 提示及整页刷新恢复。
- 两处 vercel.json 仅禁用本次确切分支 `fix/cache-permission-feed-recovery` 自动部署，不扩大产品范围。

非阻断注释建议已处理：最终提交中 `apps/web/lib/api.ts` 明确说明 feed/tags 动态门禁与共享 Data Cache 的区别。

## 验收证据状态

静态回执 `typecheck.txt`、`build.txt` 已阅读，均成功；构建显示 tags 为动态页面。这只证明静态检查与构建成功。

已阅读独立现场 acceptance.md/race.md 及下列原始回执。限定补充修复的现场路径通过；未将静态构建当作业务通过。


## 最终证据复核

- PASS：`api-revocation.json` 与 `web-revocation.json` 覆盖配置缺失、不可达投递和直接 SQL 已轮换 revision 但无事件三种场景。匿名 API 返回 preview，无合成受限标记；canonical 无受限标记，旧 render 404。这里没有证明“直接 SQL 收紧且不轮换 revision”安全；支持路径仍是 SQL 后 cache refresh。
- PASS：`race-receipt.json`、`race-cache.json`、`race-cache-hit.json` 和 `race.md` 共同证明真实旧渲染已取到全文后暂停，refresh 完成并轮换版本，再释放旧响应；旧 full Data Cache 落盘晚于 refresh，随后旧 key 仍404、新 canonical只预览。两份实际缓存 revalidate=86400；同版本源标题改变但页面保持缓存标题，证明数据缓存真实复用。该轮投递超时 failed，不能冒充成功失效同窗。
- PASS：`browser-cursor.json` 记录真实浏览器旧两字段请求400、出现刷新提示、点击刷新后新三字段请求200且可见40条文章链接；移动端无水平溢出。此处旧页面通过浏览器注入构造。
- PASS：`legacy-data-cache.json` 在安装的 Next 缓存键算法下保留真实旧 /api/feed FETCH 条目，revalidate=86400，新首页包含实际新cursor且不含旧cursor。旧条目仍存在；这证明缓存键隔离，不等价于完整旧build跨部署演练。
- PASS：`pin-pagination.json` 为后来加入 race 样本后的48条数据，失败投递 failed|3 时旧版本409，新版本200；分页20/20/8、唯一48、顺序与独立SQL一致。不要将其与最初47条20/20/7阶段混淆。
- UNVERIFIED：外部 CDN 和 Full Route Cache HTML 命中；响应 private/no-store 与内部 Data Cache 命中可同时成立，不能将两者混为一谈。

- PASS：`race-success-receipt.json` 与 `race-success-cache.json` 补证成功失效窗口：3139 的旧 full 请求在15:51:05.501暂停；第二真实Next3140共享生产build与文件缓存处理失效，事件15:51:10.106 verified；CLI于.181完成；恢复旧请求后旧full缓存于.188落盘。后续旧render404、新canonical仅预览。此本机双实例条件被明确记录，不能推论生产CDN行为。
- PASS：`database-failclosed.json` 显示隔离DB暂停时已预热canonical与分页门禁约3秒返回503无正文；`unpublish-delete.json` 显示缺失投递情况下撤销与删除后canonical/API均404无正文。
- PASS：105旧死信没有阻止新事件verified|1；`deadletters.txt`最终100/105 verified、剩余5条failed attempts6，符合单批100的有界retry。`deadletter-page.json`同时核对实际标题与公开正文。初次密钥过短403的配置失败已留存，修正后重新验证，不把初次尝试算通过。
- PASS：`acceptance-cleanup.txt` 记录audit内容和事件均0；`race-cleanup.json`记录清理2篇独立文章与4个事件。进程与容器统一收尾由主agent完成。

## 交付判断与剩余范围

可以交付补充 Draft PR：未发现需要进一步业务修复的确定缺陷。提出的注释不一致已解决；验收报告死信剩余attempts描述的小错误已通知执行者更正。原PR #16/#17已合并，本审查仅针对补充diff，不重开重复实现。

仍未现场验证平台Full Route Cache/CDN命中、真实完整旧发布物跨部署、API进程单独退出；当前证据分别为本地86400秒Data Cache、保留植入旧缓存键和DB不可用失败关闭。没有读取生产数据、真实付费正文、生产迁移、合并或部署。本审查者不负责推送；远端最终SHA/CI状态应由主agent另附，不能由本地业务提交成功推定。
