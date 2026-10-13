# Issue #23 独立验收与 review

结论：**本次隔离范围 PASS，未发现剩余合并阻断项**。该结论仅涵盖下面实际执行的路径。远程 Vercel 构建 **FAIL**，基线 main 同样已失败；生产部署与真实生产用户路径 **UNVERIFIED**。不能把本地构建、HTTP 200 或合成规模性能数据当作生产通过。

## 版本与环境

主要矩阵实现 HEAD：`d8f5afc483cec81f29c02c1bebfec654090f6a49`，PR #25。最终源码 HEAD：`b791565e985347d74c85e3a9ef41cf25f48c5485`，相对前者仅 API DTO 的 publishedAt 明确转换 ISO 日期；该行已独立审查，API重新构建、重启后实际搜索200，ISO日期复验通过（final-iso-api.json）。未重复整套矩阵，因为数据库、授权、额度和定位行为无改动。首次初版源自基线 `4ab867a7fd34f7f58c79aba7887fcd5fa5366a17` 的未提交实现；中途发现并修复的问题见下面历史记录。最终 `pnpm typecheck` 与 `NODE_ENV=production pnpm build` 均退出 0，日志 `typecheck-d8f5afc.txt`、`build-d8f5afc.txt`。API/Web 已在该实现代码完成构建后重启运行；随后精确 d8f5afc 的再次构建没有源码修改。源码/产物索引见哈希工件。

独占 PostgreSQL 17.11，127.0.0.1:55473；业务库 `yoryon_search_review`，最终空迁移库 `yoryon_search_empty`。API4473，Web localhost3173，独占 FS `/tmp/yoryon-search-review-20261013/media`；密钥/会话位于权限 700 的临时目录，env/token 文件权限 600，不在工件内。SMTP 127.0.0.1:1 无监听，没有向真实用户发邮件，没有读取或修改生产业务库。

macOS Apple M5 Pro。浏览器工具 iab/chrome 均不可用，inventory browsers=[]；用户明确授权后采用 Playwright 新建 Chromium1248 独立 context，未操作用户日常 Chrome。手机视口 390×844。实际脚本只在临时 heredoc/REPL 中现场执行，没有新增固定验收脚本、测试程序或生产测试钩子。

真实作者输入通过现有 CLI 发布 25 篇 article/post，包括免费、paid none、标题/描述匹配、Markdown/代码/Emoji/双空格/软换行及 21 篇分页正文；随后创建引用父作品/合集并现场修改、下架和删除目标。独立注册数据前提：在本库建立三个 active 用户（free/member/admin），实际 API及浏览器登录。订阅由真实 CLI grant 获得，到期仅修改本次用户权益时段，再 grant、真实 CLI revoke。作者输入的历史副本是证据，不是运行入口。

## 实际结果

| 路径 | 状态与观察 | 证据 |
| --- | --- | --- |
| 精确匹配 | 中文、abcABC命中而abcabc不命中；双空格命中而单空格不命中；Emoji跨强调、代码块、多处命中返回正确节点与UTF16范围；标题/描述参与检索。短/标点查询只检索元数据，bodySearch=false | api-matching-permissions.json |
| 免费及付费权限 | 匿名/免费对付费秘密探针仅返回公开文章级元信息，没有hits/revision/偏移/次数；猜测revision的locate403。会员/admin返回付费位置且locate200 | api-matching-permissions.json |
| 付费HTML与缓存 | 会员访问后匿名同URL HTML不含秘密探针和私有代码；API响应private/no-store。BFF额度429仍private/no-store/no-referrer，内部匿名header不暴露，cookie HttpOnly/Secure | anonymous-html-bff-cache.json |
| 到期/撤销 | 浏览器会员到期后旧定位403提示，正文恢复锁定且无秘密；重新grant后CLI revoke，真实搜索恢复有限额度且付费结果无hits | browser-expired.json/png、member-regrant.txt、member-revoke.txt、browser-revoked.json |
| 十次与失败计次 | 无效参数400；零结果每次从9递减到0；第11次429、清Cookie429、重新免费登录同网络429；重放200不计，改参数400；会员在耗尽网络仍无限200 | api-quota-pagination.json |
| 原子边界 | 9次后12个并发新查询，恰好1次200到额度0，其他quota429或并发busy429；没有超过10次受理 | atomic-tenth-boundary.json |
| 分页归属 | 20+1分页，额度不变；陌生匿名会话409，非20整倍数400。浏览器实际加载21项 | api-quota-pagination.json、browser-pagination-keyboard-empty.json |
| TTL/数据库失败 | 人为把自己的session移到61分钟前/过期后，同requestId新请求200并产生新session；表锁造成真实503，恢复后下一次剩余8（失败未扣） | ttl-timeout-quota.json |
| 更新和旧版本 | CLI修改正文，旧分页及旧locate409，新词200。正文或标题更新重新投影 | update-cli.txt、update-old-location.json |
| revision全生命周期 | 正式cache refresh、合集元信息更新、引用目标更新/下架/删除后，父作品投影与revision一致；下架/删除目标不返回；父作品自身正文仍搜索200，目标正文不被父级检索 | cache-refresh-final*、collection-revision-carry.txt、referrer-*-carry.txt、final-lifecycle-api.json |
| 最终迁移 | 主隔离库执行SQL0011后重建；修正函数以DDL回执更新旧初版库。另独立空库执行最终正式pnpm db:migrate，12条迁移、空投影、函数定义与最终一致 | trigger-fix-ddl.txt/sql、final-empty-migration.txt、final-empty-schema.txt |
| 浏览器定位 | 真实点击结果后Emoji跨两个文本节点高亮，CSS黄色；公开article Shiki与私有article客户端相同t7代码字节，Range均精确代码文字；post同样正确 | browser-emoji-location.json/png、browser-code-location.json、browser-server-private-code.json |
| 多处导航 | 结果展示最多3处，详情实际导航全部4处，节点偏移0/5/10/15，各Range均重复命中 | browser-multiple-hit-nav.json、browser-multiple-hit-mobile.png |
| 手机/键盘/空态 | Enter提交，Esc关闭并焦点返回搜索按钮；手机20+1加载、零结果空态；390宽无横向溢出（scrollWidth375）；双空格与软换行真实可见 | browser-pagination-keyboard-empty.json、browser-final-whitespace.json/png |
| 错误重试 | 真实缺投影造成503与错误/重试入口；CLI rebuild后实际点击重试200并恢复结果 | browser-unavailable-retry-before.png、browser-retry.json/png |
| 超额引导 | 浏览器耗尽真实剩余次数后429，显示本小时搜索次数已用完与恢复时间，开通按钮href=/redeem | browser-quota-exhausted.json、browser-quota-exhausted-mobile.png |

## 性能证据及限制

10000篇隔离规模文章平均4907字符，正文以不同md5字符串加中文段落/稀有探针组成，**这是合成规模数据，不是真实内容语料或真实业务分布**。它用于检验规模、索引、候选上限、短查询与超时，不宣称达到所有代表性业务负载指标。CLI真实重建10025篇（含前述25篇），后续增加父作品并删除目标不影响规模结论。

初次rebuild后只ANALYZE，中文稀有查询曾Seq Scan 39.9ms。VACUUM清理pending后BitmapOr三GIN，100项1.008ms；最终实现rebuild主动gin_clean_pending_list+ANALYZE，未另执行VACUUM的复查仍使用三个GIN，100项约1.06ms。实际完整候选CTE计划、1~2字符/标点元数据计划均保留。短查询完全不读body_text；元数据扫描仍可能发生，限1001候选，超限422，不悄然扫描所有正文。

单并发，每词20次真实会员API请求：中文稀有词P95 9.391ms、fffffff P95 53.444ms（200）；高命中abc和普通段落文字明确422，P95 32.770/11.303ms，拒绝不算受理。时间从客户端发送至完整JSON读取，包含服务端授权/会话/分页；本地预热结果，不是网络生产P95。没有把20次样本或人工规模数据当成生产保证。

证据：performance-data-setup.txt、rebuild-scale.txt、explain-partial.txt、explain-chinese-vacuum.txt、explain-query-plans.txt、explain-final-rebuild.txt、api-performance.json。1.5s数据库语句deadline/锁超时已由真实锁场景验证失败关闭；并发上限由真实并发拒绝验证。所有高并发组合和大规模真实业务语料仍UNVERIFIED。

## 独立 review 与修复记录

已按 architecture-review 技能只读检查依赖方向与业务边界：config仅浏览器可用纯文本协议；core负责发布派生投影；API复用canAccess/canAccessMany唯一裁剪位置；web读取授权结果和节点映射，不下载全部作品全文检索。BFF私有缓存、搜索词仅POST体/加密短期会话、fragment不进入页面路径日志。未发现新增模块级依赖循环或跨层授权绕过。

本轮两个真实失败均已修复：

1. 初版CSS折叠正文双空格/软换行，导致投影与可见文本不一致。最终正文span及搜索context保留原空白，浏览器innerText和Range复验PASS。
2. 初版SQL触发器对任何revision轮换删除投影。实际cache refresh成功后全站搜索503。最终触发器仅文本变化/下架删除投影，纯revision变化只carry匹配旧revision的投影；cache refresh、合集、引用目标更新/下架/删除分别现场复验PASS。历史失败证据保留，不作为最终现状。

合并判断：本次源码范围无剩余阻断。Vercel远程FAIL与精确基线main相同，/explore prerender tags API404在本分支前已发生；因此它不是本次源码回归依据，但仍为上线阻断，不计PASS。详见vercel-check.md。生产部署、生产API版本/迁移/权限/CDN和真实用户路径未验证，不能宣称上线成功。

未覆盖：真实生产语料/网络/OSS、所有Unicode组合及Markdown扩展、全部浏览器引擎、大于100次正文命中跨批导航、全部迁移发布重建并发组合、进程崩溃恢复、生产匿名网络归因及所有中间代理缓存。范围外保持UNVERIFIED，不能以这份报告推断全覆盖或生产性能。

工件密钥/会话安全扫描与SHA256索引见artifact-safety.json、manifest-sha256.json。环境收尾由cleanup.json记录；如该文件尚未生成，独占环境仍保留等待最终头确认。
