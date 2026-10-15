# 独立生产验收（API阶段，Web待READY）

时间2026-10-15；image/source2679777df17d026a655faa1f63c83eebde0308d9。无生产业务写入、无账号创建、无邮件。

PASS：SSH读取容器image；用migrate.env保护配置docker run node/pg，BEGIN READ ONLY查询，ROLLBACK退出：15条迁移；analytics_events.visitor_id、analytics_visitors表、contents.show_in_home存在；API ledger权限SELECT/INSERT/UPDATE、CLI SELECT。业务25篇均published/public/show_in_home=true（16post+9article），0合集。回执independent-schema-after.json。

PASS：直接https://api.yoryon.com读取member-feed/collections均空，feed20纯content，公开文章freedom-before-wealth access=full且正文2748字符。回执independent-api-after.json。状态与业务库事实匹配，不以200单独作为通过。

已纠正的验收命令错误（非生产故障）：绕过Compose使用docker run时CLI入口无法启动。实际命令：ssh admin@8.222.152.17 'sudo docker run --rm --network yoryon_backend --env-file /etc/yoryon/cli.env --entrypoint node yoryon-api:2679777df17d026a655faa1f63c83eebde0308d9 /cli/dist/index.js content list'。退出1：Invalid CLI environment: MAIL_SMTP_PORT: Invalid input: expected number, received NaN。--help正常但未验证配置，不作为CLI可用性通过。主agent指出Compose env_file与docker --env-file对引号值处理不同；真实项目流程已复验通过，不需要修复生产配置。未修改环境文件。

UNVERIFIED：Web尚未promote；付费发现有内容、付费正文拒绝/授权、合集聚合/动态返回生产路径（生产0paid/0collection，不写示例）；visitor首次插入/回访更新（此轮只读授权）；不使用本地示例冒充生产通过。


CLI复验PASS：实际运行项目规定命令 `ssh admin@8.222.152.17 'cd /opt/yoryon && sudo docker compose -f compose.neon.yml run --rm --no-deps cli content list'`，退出0，输出生产已发布public内容及home状态。完整stdout/stderr分别见independent-cli-list.log、independent-cli-list-stderr.log。此前docker run失败由验收者偏离项目Compose环境解析流程引入，撤销CLI发布阻断结论。stderr仅Node url.parse弃用提示。

## 正式域名最终独立只读验收

API/Web READY并promote后，独立Python urllib请求https://yoryon.com实际页面与新BFF、分页和详情。PASS：首页包含当前最新作品；/api/feed携带首版version跟随nextCursor读完两页，共25个唯一id，类型article/post，与生产25published/public一致；/api/member-feed新BFF正常返回空items，订阅HTML显示“还没有会员作品”，/c显示“还没有合集”。

PASS：公开article freedom-before-wealth与post note-2026-09-27-1的详情HTML存在，匿名API均access=full，正文分别2748/203字符。PASS：从生产首页实际资源引用读取1CSS+3JS，类型正确、非空，保存长度与SHA256（CSS54510字节，JS5372/173020/173933字节）。完整回执independent-web-after.json，不以HTTP200单独当业务证明。

临时验收资源复核：lsof -nP -iTCP:4127 -sTCP:LISTEN 与3027均无监听；临时DB及私有env此前已删除。交付给用户的常驻主预览3000/4116不属于临时验收资源，未停止。无生产业务写入、用户创建、邮件发送。自然浏览器访问可能产生正常分析事件，不解释为用户数。

当前独立结论：PASS（现存生产公开读路径、迁移、角色权限、CLI、25内容分页及静态资源）。UNVERIFIED：生产付费正文/权益、非空会员合集/章节动态返回（没有对应生产数据）；visitor首次插入/回访更新（只读范围）；等待主agent真实Browser截图供独立审阅。此前Web待READY状态由本节更新。

## 最终Browser截图与自然事件落库审阅

子agent用view_image独立审阅production-home.jpg、production-article.jpg、production-subscription.jpg：PASS，首页文章和动态实际可见；“先自由后财富”正文有实质段落，顶部普通返回按钮可见；订阅会员作品tab显示“还没有会员作品”。主agent实际Browser执行首页→文章→顶部返回至正式首页→订阅页，动态导航归主agent执行，截图由子agent独立审阅。domain-after.json正式alias指向dpl_CqBbP81RxdAQsFYFm2gagznfFwem，与READY应用部署匹配。

自然访问后独立只读聚合查询：使用保护的migrate.env容器node/pg BEGIN READ ONLY，查analytics_visitors count及analytics_events中visitor_id非空计数；没有读取cookie/session或visitor标识明文，没有手工发送测试事件。independent-visitor-counts.json记录ledger_rows=1、identified_events=8、recent_identified_events(30分钟)=8，而切API后初始ledger为0。PASS：自然Browser访问后新访客ledger及带标识事件已实际落库。此处1为持久匿名标识条目，不等于1个真人；8为事件数。单靠聚合不能证明所有事件均出自本次浏览器，也未独立证明回访更新时间语义，后者仍UNVERIFIED。

最终生产交付范围PASS，无发现发布阻断。已验证源2679777对应新API、新Web正式alias、迁移/权限/CLI、现有业务读路径、实际资源、Browser可见页面与自然访客事件落库。无生产新账号、业务内容或邮件；不将0付费/0合集的数据缺口写为对应路径通过。临时验收资源已清理，主本地交付预览保留。
