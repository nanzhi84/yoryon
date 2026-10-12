# 独立现场验收（完成）

版本：f166cc6ad419df1dc4b3844e5e29d1cd64c3e1d5。隔离 Docker PostgreSQL yoryon-review-pg/yoryon_review :55439；API :4439；production Next :3139，FEED_REVALIDATE_SEC=86400。合成文章 audit-00..46，临时 Markdown 在 /tmp/yoryon-audit；不含真实正文或账户。遵循根 AGENTS.md；仓库不存在 .agents/skills。现场命令均内联，无固定测试程序。

- PASS CLI publish：47篇相同 published_at=2026-10-01T12:00:00.000Z，CACHE_REVALIDATE_URL=''；均落库且 pending(configuration missing)，见 acceptance-cli.log。
- PASS CLI pin + API分页：依次 `CACHE_REVALIDATE_URL='' node --env-file=.env apps/cli/dist/index.js content pin audit-00..23`。操作前 version+cursor 再请求 /api/feed 得409 snapshot_expired。新分页20/20/7条，pin20/4/0条，47 unique，ID全序与独立SQL `ORDER BY is_pinned DESC,date_trunc('milliseconds',coalesce(published_at,created_at)) DESC,id DESC`完全一致（无重无漏、超过一页置顶、相同毫秒tie）。
- 正文预热：audit-00/01/02 canonical 各请求两次均200，含对应 SYNTHETIC_RESTRICTED_0/1/2。随后00以缺失URL CLI重发为paid+marker，01以不可达 :59997 CLI重发为paid+marker，02直接SQL提交paid+marker+新revision且不创建事件。结果见后文。

- PASS 权限撤销三路径：`web-revocation.json`/`api-revocation.json`。缺失URL、不可达URL、无事件SQL提交，均从已预热全文切换为公开预览；canonical200仅VISIBLE、无RESTRICTED，旧render404；公开API access=preview，无RESTRICTED。这里missing URL先提交，后续不可达CLI全局重试把前一pending也标failed3，两者没有任何成功失效投递。
- PASS 预览进一步缩短：audit-00 marker→none，以缺失URL CLI发布；API和canonical均200，VISIBLE_0和RESTRICTED_0均不出现。不是只检查HTTP200。
- PASS 真实共享Data Cache：`shared-cache.json`。audit-03预热后SQL仅追加隔离标记、不改revision（专为观察缓存的现场探针，不代表支持不轮换revision的编辑流程），直API有标记而canonical无标记；Next磁盘FETCH条目明确revalidate=86400。随后恢复正文。证明跨HTTP请求确实复用长TTL内容，不仅源码声明。响应no-store与内部Data Cache是不同层。
- PASS 旧两字段浏览器实际恢复：`browser-cursor.json`及两张截图。Playwright Chromium 390×844，仅首次首页HTML内将当前三元组cursor替换成相同t/id的旧两字段cursor，模拟已打开的旧页面；真实按钮点击发400 invalid_cursor，出现“列表已更新。刷新列表”；点击刷新发新三元组请求200，40条合成文章链接，无水平溢出。注入的是旧页面响应，不是伪造分页API结果。
- PASS 旧Data Cache键兼容（植入方式）：`legacy-data-cache.json`。使用本机Next IncrementalCache.generateCacheKey，先确认算法产生真实现存feed键；再将旧无query URL /api/feed 的86400 FETCH条目放入真实fetch-cache，body含旧两字段cursor。新首页保留该旧文件但不读旧cursor，含实际API新三字段cursor。未运行旧发布物再跨部署；此项为真实存储旧条目保留模拟，不声称完整平台跨部署测试。
- PASS 失败投递后pin浏览器恢复及分页：`pin-pagination.json`。页面保持打开，CLI对audit-46 pin且URL不可达，事件failed|3；旧LoadMore409→点击刷新→新LoadMore200，version已变，audit-46出现在置顶段。此时含race合成文章共48条，20/20/8，pin20/5/0，48unique且全序与独立SQL一致。
- UNVERIFIED 本地Full Route Cache HIT：canonical响应没有x-nextjs-cache，不能以Data Cache证据声称Full Route Cache命中；平台CDN跨部署缓存也未现场运行。
- 105死信首轮：105较早failed3未阻塞后续新事件被尝试；但本地secret小于32字符导致正常签名请求403（配置失误，不是修复代码失败）。随后统一长secret并重验成功投递/人工retry（见下一项），不将此初轮记PASS。
- PASS 更正本地secret≥32并重启API/Next（同build）后，105较早重试耗尽事件仍在队列（100条attempts6、5条attempts3），正常publish audit-05的新事件verified|1；后续人工cache retry后，105条中共100条verified（95条attempts7、5条attempts4），余5条failed attempts6；单批上限100，符合有界处理，不据此推断本轮处理对象均为最老100条。见deadletters.txt/cache-retry-success.log。真实canonical audit-04显示已更新标题audit-04-after-deadletters和合成公开全文标记，见deadletter-page.json，故不仅以事件数量或200判断。
- PASS 数据库不可用失败关闭：`docker pause yoryon-review-pg` 后访问已预热audit-03 canonical，3076ms返回503且无正文；分页门禁3019ms返回503 policy_unavailable；finally中`docker unpause yoryon-review-pg`。见database-failclosed.json。这是DB不可用，不声称另做API进程退出场景。

## 关键现场命令（回执在相邻JSON/日志；非固定测试入口）

```sh
CACHE_REVALIDATE_URL='' node --env-file=.env apps/cli/dist/index.js publish /tmp/yoryon-audit
CACHE_REVALIDATE_URL='' node --env-file=.env apps/cli/dist/index.js content pin audit-00
CACHE_REVALIDATE_URL=http://127.0.0.1:59997/api/revalidate node --env-file=.env apps/cli/dist/index.js publish /tmp/yoryon-audit/audit-01
node --env-file=.env apps/cli/dist/index.js publish /tmp/yoryon-audit/audit-05
node --env-file=.env apps/cli/dist/index.js cache retry
```

无事件权限收紧实际SQL：
```sql
UPDATE contents SET visibility='paid',preview_mode='marker',revision=gen_random_uuid(),updated_at=now() WHERE slug='audit-02';
SELECT id FROM contents WHERE status='published' ORDER BY is_pinned DESC,date_trunc('milliseconds',coalesce(published_at,created_at)) DESC,id DESC;
```

缓存键现场计算使用安装的Next实现：
```js
const {IncrementalCache}=require('./apps/web/node_modules/next/dist/server/lib/incremental-cache');
await IncrementalCache.prototype.generateCacheKey.call({},'http://127.0.0.1:4439/api/feed',{headers:{accept:'application/json'}});
```
将实际版本化feed FETCH文件复制为该旧键（url改旧URL，base64 JSON body nextCursor去掉p，revalidate保持86400），请求首页，结果在legacy-data-cache.json。浏览器采用系统Chromium的Playwright，`page.route('http://localhost:3139/',...)`只替换第一次HTML内cursor，然后真实点击 `getByRole('button',{name:'加载更多',exact:true})` 和 `刷新列表`；网络400/200回执与截图保留。没有修改生产源码或插入生产测试钩子。

跨旧渲染窗口由另一独立验收者以真实Next inspector调度，详见其并发报告；本报告不重复计为自己的执行结果。

- PASS 额外撤销路径：缺失投递URL执行unpublish audit-06及content delete audit-07，canonical及公开API均404且无合成正文，见unpublish-delete.json。
- PASS 清理：删除所有audit-*内容与事件（含105死信），查询均0；删除/tmp合成Markdown及临时JSON。保留race-*供并发验收者清理。见acceptance-cleanup.txt。Next本地合成缓存将由主agent结束服务及销毁隔离环境统一清理。

结论：本轮限定修复路径现场通过，无未处理业务失败。未验证项为平台Full Route/CDN跨部署真实命中、完整旧发布物部署升级、API进程单独退出场景；已验证真实86400 Data Cache、旧键保留模拟和浏览器恢复，不将上述未验证项包装成通过。
