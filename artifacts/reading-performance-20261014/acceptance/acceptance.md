# 阅读性能独立验收

2026-10-14。独立agent现场使用真实发布内容、当前CLI/API/SQL、专用IAB与751×896视口验收。基准提交 `288471a440096df2f463211060a5eae3c5ea93af`，当前变更与实际构建源码以父目录 source-manifest.json/source.diff 为准。隔离数据库 `yoryon_reading_performance_20261014`、API4117、Web3117和新FS，环境与来源见 environment.json，执行方式见 commands.md；不新增固定测试程序/fixture/harness。

## 结论

| 范围 | 结果 | 现场证据 |
| --- | --- | --- |
| 用户所指09.27帖子展开/收起 | PASS | 完整尾段显示/隐藏正确；展开无任何网络请求，Markdown DOM节点保留。local-expand.json。本地click→DOM0.3ms只证明DOM更新快，不表示绘制时间。 |
| 大公开帖/关联媒体帖保护分支 | PASS | 7758byte公开稿在feed只给485byte且collapsed=true；有媒体关联真实稿仍走折叠/请求路径。阻断大帖请求出现中文错误，清阻断点击重试显示真实全文尾段。large-error.json、large-expanded-dom.txt。 |
| 自动分页、失败暂停、结束 | PASS | 实际滚动主动加载第二页；阻断后明确失败/重试，继续滚动未循环请求且旧项保留。恢复后逐页显示真实内容。最终三页43个不同slug，第三批互动仅自己的3个ID，旧两批不重拉；尾部继续滚动没有后续请求。page-error.json、automatic-pagination.json、final-three-pages.json。 |
| 快照改变/旧游标 | PASS | 实际CLI发布推进catalog后，旧页自动请求得到409，提示刷新；原列表不混入新快照。真实点击刷新拿当前版本。final-expired-cursor.json。 |
| 文章进入/反馈/返回 | PASS | 最终动态canonical冷点击真实正文与评论区域出现，正在打开状态出现；预热后点击仍核对当前门禁。原rewrite补请求已消除。三页返回保留43项和click时实际scrollY6441。final-dynamic-cold.json、final-dynamic-warm.json、final-return.json。 |
| canonical当前版本与浏览器缓存 | PASS | 真实HTML/RSC Cache-Control private/no-cache/no-store，无rewrite。伪造旧revision header仍取得当前paid预览；旧/render404。旧浏览器disk cache保留期间观察到额外旧响应读取，但新出网响应不缓存；预热后权限改变的实际可见状态没有旧全文尾段。final-canonical-headers.txt、forged-header-canonical.html、old-render-headers.txt、public-to-paid-browser.json。 |
| 付费展开/会员/退出 | PASS | 匿名展开发请求只显示真实1518byte允许预览；普通会员CLI授予订阅、真实登录后展开取得7758byte全文尾段；退出后Back旧页面已收起无旧尾段，再展开发新请求只显示预览。paid-anonymous-browser.json、paid-member-browser.json、paid-logout-browser.json。 |
| 删除阅读全文 | PASS | 首页实际DOM和SSR都无阅读全文重复链接，标题/封面入口仍可进入全文。final-home-dom.txt、home-ssr.html及真实导航证据。付费预览提示中的“阅读全文”文字保留，不是重复入口。 |
| favicon与头像 | PASS | 源头像1728×2304、页头object-position50%/30%对应方形裁切；PNG512/180与ICO16/32/48，服务字节SHA256与源码完全相同，head入口正确。icon-crop-compare.json、icon-ico-dimensions.json、served-icon-sha256.txt。 |
| pin-v3最终缓存键构建烟检 | PASS | 最新构建新IAB标签首屏20篇，09.27实际展开有完整尾段且无内容请求；真实滚动第二页20→40个唯一slug并显示正文。运行中的Next fetch-cache同时记录首屏/第二页实际API URL包含protocol=pin-v3。pin-v3-smoke.json、pin-v3-build-cache-urls.json。 |
| 生产部署与同环境时延分布 | UNVERIFIED | 本轮没有生产发布或写生产业务数据。线上原状单次展开279.9ms/标题901.8ms主要为网络等待；本地结果不能与线上直接同比。production-baseline.json。 |
| 子agent像素截图/绘制时延/长时运行 | UNVERIFIED | IAB子线程不支持visibility，截图API超时。独立agent以DOM/网络/SQL/字节自行判断；主agentroot另取expanded-post.png/article.png，不把主agent截图算成独立像素观测。未测绘制时延、跨系统字体、长期运行或大媒体播放状态。 |

当前功能范围没有未解决的FAIL。初版实际发现 canonical RSC共享缓存覆盖no-store与冗余rewrite请求，已记录原失败工件并由主agent修正后真实复验。预热→改付费观察没有发现旧全文泄露；缓存风险推断不作为已发生泄露报告。没有以构建成功、HTTP200或记录数单独判定业务通过。

## 数据与清理状态

freedom在验收结束前已恢复原始公开源。全部验收内容和账号只在本轮新数据库与FS，未发真实邮件。收到主agent明确清理通知后，关闭自身3个IAB标签，停自身API，删除本轮专用数据库、FS与0600私密配置/密码/token/内容复制目录；其它数据库/preview/artifacts未删除。原有yoryon库内容仍7篇，本轮数据库名字已经不在PostgreSQL列表。cleanup.json/pre-cleanup.json/post-cleanup-databases.txt记录范围和回执。

最终工件与保留的临时build目录共按本轮随机秘密做精确匹配扫描：工件无命中，保留build536个非依赖/非Git文件无命中。根临时build源码/产物按主agent要求保留，未删除。父agent的Web服务与标签由父agent收尾，不在子agent清理范围。隔离数据已清理，复现必须重新建库、配置与真实数据，不能把工件中的历史UUID当仍存在的固定fixture。

未覆盖项：恰好4096/4097字节的两个构造样本（未为固定边界伪造正文）；已用587、2701和7758真实字节规模验证限制内/外分支。现有真实帖子无活动音视频，本轮未宣称播放状态验收。IntersectionObserver缺失环境、旧浏览器兼容与生产网络分布未验。
