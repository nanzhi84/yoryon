# 帖子指标独立验收

结论：**PASS，未发现阻塞缺陷**。真实 IAB 浏览器 → 同源 BFF → bundled API → 隔离 PostgreSQL，以及 bundled CLI 输出交叉核对。不是以构建成功或 HTTP 200 代替行为验收。文章和帖子分别按不同口径记录。未部署生产。

## 版本、环境和复现

Web/API 来自 `62c20cd` 的 `pnpm build`；最终源码 `bad8f13` 仅追加 CLI overview 的 N/A 与文档，CLI 再独立 `pnpm --filter @yoryon/cli build`。产物和源码 SHA256 见 runtime-manifest.json。主 agent 的 `pnpm typecheck` 通过回执在 typecheck.txt，独立 agent 检查该回执后没有无变化重复运行。构建 build.log 通过；CSS ::highlight 提示是原有编译警告，不影响本次最终可见页面。

数据/命令见 reproduction.md。全程使用独立本地库 `yoryon_post_analytics_20261015`、fs 存储、随机 0600 配置；没有生产数据或真实账号。实际产物启动命令：

```sh
# apps/api
NODE_ENV=production node --env-file=<本次临时env> dist/index.js
# apps/web
NODE_ENV=production node --env-file=<本次临时env> node_modules/next/dist/bin/next start -p 3030
# root（注入隔离env，NODE_ENV=production）
pnpm build
# apps/cli
node --env-file=<本次临时env> dist/index.js cache retry
node --env-file=<本次临时env> dist/index.js analytics content short-note --days 1
node --env-file=<本次临时env> dist/index.js analytics overview --days 1
node --env-file=<本次临时env> dist/index.js analytics top --metric views --days 1
```

## 现场行为结果

| 真实路径与观察 | 结果及证据 |
|---|---|
| 首页公开短帖滚入视口 4 秒，滚回顶部，停留十余秒 | 只 impression1、read0；不是只因尚未 flush 得出空结果，滚出后原队列正常入库 |
| 同一列表实例恢复短帖 1.6 秒，再滚出 | read1；同一实例再次可见6秒仍read1，scroll-cumulative-sql.txt |
| 首次首页付费预览自然前台停留 | impression/read各1，来源home_feed；仅代表当前可见预览，不代表全文权限 |
| 新列表长帖主动展开→收起→重展开→停留6秒 | 同实例read仅1；跨两个真实列表总read2/distinct实例2，expand-dedupe-sql.txt |
| 实际长帖展开可见第7至28段，按钮变“收起” | expanded-post.png；页面没有新增展开指标 |
| 文章详情显示完整正文11秒 | View1/Read1，placement NULL；帖子详情12秒无新增Click/View/Read，details-sql.txt |
| 新文章详情实例仅5秒→隐藏flush | View总2而Read仍1，article-five-seconds.txt；文章没有被改为5秒 |
| 标签页长帖展开并停留6秒；订阅页付费预览展开并停留6秒 | 无新事件，原有不采集表面未扩大 |
| DNT、GPC分别从全新subscription文档注入信号，再真正点击首页并停留7秒 | 事件总数始终14；privacy-and-other-surfaces-count.txt。**SIMULATED WebAPI信号**，不是浏览器原生隐私设置 |
| 模拟hidden初次首页7秒→visible4秒→hidden十余秒→visible1.6秒 | 前4秒有曝光无新read；恢复后paid read从1→2。hidden-four-second-sql.txt / hidden-resumed-sql.txt；**SIMULATED visibility getter+visibilitychange** |
| CDP仅阻断本地paid-note详情请求，真实点击展开 | 显示“帖子加载失败。重试”，按钮仍“展开”；第二次新实例在0.7秒内隐藏停止时钟，没有即时read。第一轮停留过久可按5秒自然read，未拿它证明失败拒采 |

上述滚动通过真实页面 `scrollTo` 改变位置、真实 IntersectionObserver 回调运行；没有替换计时器/Observer或直接调用埋点函数。首次4秒的Runtime.evaluate默认3秒CDP回执超时，但页面中的4秒操作完成，后续实际scrollY=0与SQL已核对；后续计时命令显式放宽CDP等待，不将超时当业务失败。卡片真实几何1280×720下：paid高418px、长帖折叠414px、短帖138px。

## API与历史报表

通过 `http://localhost:3030/api/analytics/events` 发送随机eventId的现场请求，Origin为该同源地址；短帖legacy read(NULL)、view、click(home_feed)、read(collection_list)均HTTP200但accepted0，逐eventId独立SQL均0；read(home_feed) accepted1且SQL1。见 api-boundary.json / api-boundary-sql.txt，不能仅凭200判通过。

仅在隔离库插入该短帖旧式read(NULL)/view/click各1后，CLI content仍只计read(home_feed)，click/view/ctr为N/A，read_rate=reads/impressions；overview按post/article/collection分组，post旧read未混入，views排行只含article。见 legacy-row-insertion.txt、cli-post.txt、cli-overview.txt、cli-top-views.txt、final-sql.txt。没有删除或回填旧事件。

## 独立源码审核

检查 `6cba90a..bad8f13`：PostAnalytics统一计时/展开read回调和列表ID+帖子ID去重；滚出/hidden调用pause保存elapsed，恢复补足剩余时间，完成后停timer；effect清observer/listener/timer。PostEntry仅成功主动展开调用read，自动恢复展开与请求失败不调用；正常滚动DOM保留，累计不用新全局状态。详情Provider按article启用，帖子日期/评论导航禁止click。API用已发布真实内容type校验post仅home impression/read，文章/合集详情read仅NULL。CLI聚合按post type剔除旧详情数据，旧原始记录保留。未新增DDL、权限绕过、网络采集来源或互动重复事件。**PASS，无阻塞项**。

## 未验证及语义边界

- **UNVERIFIED**：原生浏览器后台/隐私设置、其他浏览器引擎、真实OSS桶、生产运行。模拟明确不替代原生验证。
- **UNVERIFIED（本次未新跑）**：合集真实10秒跨章节流程；相关章节源码未修改，代码审核确认post WorkDetailProvider禁用不会取消独立ChapterReading，API NULL read和CLI合集分组仍保留。不能把既往验收冒充本次现场通过。
- 大于视口两倍的卡片50%面积不可达；严格面积定义下不会自然5秒read，主动展开仍算。快速展开可早于1秒曝光，read/impression可能>100%，不伪造曝光。
- 同列表正常滚动不卸载卡片；完整重新加载是新列表实例，允许再记一次。没有引入跨任意卸载共享累计或永久去重。

## 核心即时展开补证

主agent复核指出“展开后停留6秒”不能独立排除5秒timer路径。因此原隔离环境清理后重新创建同名空库、新独立临时env和storage（/tmp/yoryon-post-immediate-KFqvOc），同产物启动，仅用bundled CLI发布现场新写24段immediate-note。没有旧统计记录。

真实浏览器新tab2从subscription开始，点击首页前记录performance.now；真实首页展开按钮点击后AX实际出现第7至24段、按钮收起，随即模拟hidden并dispatch visibilitychange使原队列flush。整个过程 **534.9ms**，没有替换timer/Observer、没有直接调用埋点；随后SQL **read/home_feed=1，impression=0**。这单独证明展开立即阅读，不依赖5秒，且不补造曝光。实际用时和展开全文在 immediate-expand-timing.json，SQL在 immediate-expand-sql.txt。**PASS**。

补验后再次停止4030/3030、关闭仅任务tab2、DROP同名独立库并删除新临时env/storage/posts。
