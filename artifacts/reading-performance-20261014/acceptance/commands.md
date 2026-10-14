# 现场命令和环境回执

工作区 `/Users/yoryon/Projects/yoryon`。本轮所有写入均限定新数据库 `yoryon_reading_performance_20261014` 与新的 FS；原有数据库、生产业务数据和真实邮件未写入。

## 准备与发布

```sh
docker exec deploy-postgres-1 createdb -U postgres yoryon_reading_performance_20261014
pnpm exec tsx --env-file=<temporaryRoot>/acceptance.env apps/api/src/migrate.ts
pnpm exec tsx --env-file=<temporaryRoot>/publish.env apps/cli/src/index.ts publish <temporaryRoot>/content
pnpm exec tsx --env-file=<temporaryRoot>/publish.env apps/cli/src/index.ts publish <temporaryRoot>/boundaries
pnpm exec tsx --env-file=<temporaryRoot>/publish.env apps/cli/src/index.ts publish <temporaryRoot>/archive
```

`temporaryRoot` 的实际路径在 environment.json。环境文件0600，发布env省略cache投递设置，所以未启动Web期间事件保持pending；不把pending误称为页面缓存验收。正常pub已执行 current migrator 与两阶段CLI发布，回执 migrate.log/publish.log/boundary-publish.log/archive-publish.log。

25篇基准文章/帖子均来自本地当前发布源，来源目录与原文 SHA256 在 environment.json。09.27帖与生产匿名 public 内容 API 的全文一致。大稿/媒体/付费分支使用已有真实文章正文，仅修改隔离slug/type/visibility/preview/发布时间。大公开帖与付费帖都与 freedom 原稿正文 SHA256 `fdb1b48402c6ae89609161ab1e2203319211d0c28eb6b18199d31ac134c6c0ca` 一致（7758 UTF8 bytes），媒体帖与 buffett 原稿正文 SHA256 `ed6f2e95f707c12da0c8dfe4ce454b4c718a029ec13b291eb9eba0326279bd6d` 一致（8721 bytes）。另16篇真实帖子仅重新发布为隔离archive身份和日期，以现场走第三页；archive-inputs.json记录正文相同。

配置一次尝试错误：`mode: full` 带 `percent:100` 被真实 CLI 输入校验拒绝（最大99）；改为实际公开源采用的 `mode:full` 后完成发布。未绕过校验或数据库直接插入内容。

API以当前 `createDeps/createApp` stdin入口和 `@hono/node-server` 启动，明确 `hostname:'127.0.0.1',port:4117`；写操作前逐次 `select current_database()` 校验名字。实际重启后session53625，日志 api.log。主agent在临时源码目录执行本项目 `pnpm build`，再启动Next3117生产模式，未占用已有 .next 和端口。

## 协议与数据

```sh
curl -fsS http://127.0.0.1:4117/api/feed
curl -fsS http://127.0.0.1:4117/api/paid-feed
curl -fsS http://127.0.0.1:4117/api/public/contents/acceptance-paid-preview-post
curl -fsS http://127.0.0.1:4117/api/contents/acceptance-paid-preview-post
curl -fsS http://127.0.0.1:4117/api/public/contents/acceptance-large-public-post
curl -fsS http://localhost:3117/
docker exec deploy-postgres-1 psql -U postgres -d yoryon_reading_performance_20261014 -Atc "select current_database(),slug,type,visibility,length(body_markdown),octet_length(body_markdown),revision from contents where slug in ('note-2026-09-27-1','acceptance-large-public-post','acceptance-paid-preview-post','acceptance-media-public-post') order by slug"
```

本轮在 `apps/api` 目录用 Node stdin/pg/argon2 创建一个自己的active普通用户，随机密码只存在0600 credentials.json，地址example.invalid，未发信。每次写操作先确认current_database。后续真实登录/权益操作不保存密码/token/cookie。

## Browser 实际操作

Browser使用本验收chat自己的IAB。`cua.createBrowserTab`包装器45秒超时；Chrome任务会话不可用。按已返回的浏览器文档改用 `acceptanceBrowser.tabs.new()`/`tab.goto()` 后DOM、locator与CDP均可用。只操作自身新建标签，不碰用户Chrome标签。

1. 线上现状：真实点击09.27“展开”和“先自由后财富”标题。CDP捕获click→最终正文DOM以及Network时间；production-baseline.json仅单次观测，不代表时延分布。
2. 3117新版09.27：点击展开/收起，全文尾段与按钮状态实际正确；无任何内容请求，原Markdown DOM节点仍在。local-expand.json。
3. 大公开帖：本标签临时Network.setBlockedURLs只阻断其详情URL，点击展开，实际显示中文错误与重试；清阻断后点击重试，真实全文尾段出现。large-error.json、large-expanded-dom.txt。
4. 自动翻页：阻断本标签 `/api/pages/*`；通过键盘End和CDP滚轮Input.dispatchMouseEvent到列表末尾，自动请求一次；真实显示失败与重试。继续滚动并观察1200ms未重新请求，原20条仍在。清阻断后点击重试，全部27个真实slug完整出现，尾部无加载更多入口。page-error.json、automatic-pagination.json。
5. 文章意图：滚动标题进入视口，使用实际鼠标mousemove产生mouseenter预热；捕获一次RSC与文章chunk。真实点击后正文与评论区出现、正在打开状态出现；返回按钮回首页保留追加页。intent-navigation.json、intent-request-types.json、rsc-diagnostic.json记录初版问题，之后须以最终版复验。

临时性能观察通过本标签CDP Runtime.evaluate注册click/MutationObserver/PerformanceObserver，不写产品代码、测试钩子或可执行文件。所有时间只表示DOM更新，未测绘制时间。标签导航清除这些观察状态。

截图限制：原生tab.screenshot和Page.captureScreenshot均30秒超时并重置工具；不以截图成功为前提跳过已有可验证DOM/网络证据。若最终仍不能截图，视觉截图与绘制指标报告UNVERIFIED。

## 最终动态 canonical 与三页/权限复验

- 浏览器viewport实际切到用户提供的751×896，`documentElement.scrollWidth===clientWidth===751`。最终三页20→40→43个唯一slug，第三页只有自身3个ID的互动请求，未重拉前20项或第二批互动；继续滚到尾部1200ms没有后续pages请求。final-three-pages.json。
- 第二页实际标题进入详情再点击返回按钮，click时scrollY6441，返回scrollY6441且43篇仍在。final-return.json。
- 旧rewrite入口的canonical RSC共享缓存头覆盖no-store，独立记录为FAIL，主agent修正为动态 `/p` 页面，middleware覆盖 `x-yoryon-content-revision`，保留按revision共享DataCache。新cold导航只有一条意图预热与一条点击当前门禁请求，并行，随后没有rewrite补请求；feedback DOM0.8ms/body DOM74.8ms（仅本次本地观察）。最终warm导航真正出网预热1条，点击1条；旧浏览器disk cache产生一次额外旧响应读取，新出网响应均private/no-cache/no-store，无rewrite。final-dynamic-cold.json、final-dynamic-warm.json；后者按不区分大小写的header映射补齐cold响应头，前者的cacheControl字段undefined来自header大小写，不表示头缺失。
- 预热公开freedom后，用实际CLI publish同一原文的paid20%配置（public-to-paid-publish.log），API当前1518byte预览。真实点击仅呈现预览/付费状态，没有观察到旧尾段泄露；途中确有旧disk RSC及多次新RSC，协议风险与实际泄露判定明确分开。随后新动态入口带伪造旧revision header的curl仍拿当前预览，旧/render返回404，final-canonical-headers.txt/forged-header-canonical.html/old-render-headers.txt/old-render.html。完成后CLI publish原始公开源恢复freedom，public-restore-publish.log。
- 该恢复发布推进catalog版本；旧列表真实滚动触发409，原20条保留、停止自动请求、出现“列表已更新/刷新列表”；点击刷新读到当前版本且freedom重新出现。final-expired-cursor.json。
- 订阅页匿名展开paid帖子实际发请求，只有当前预览；经账户菜单登录本轮普通用户，UI显示我的会员/已开通。实际展开再次发请求，真实全文尾段出现。退出登录硬回首页后，BrowserBack旧subscription已经收起且原全文尾段不存在；再点展开重新请求，仅预览与兑换提示。paid-anonymous-browser.json、paid-member-browser.json、paid-logout-browser.json。
- 已reset临时viewport；Network阻断为空。未保存密码、token、Cookie或完整敏感请求header。最后工件精确秘密扫描见sensitive-scan.json。
- 主agent另取可见root IAB截图，独立agent只能自行确认DOM/网络：子agent调用visibility.set(true)明确报 `IAB visibility is not supported in a subagent thread`。主agent截图与独立观测的职责不混淆。

两行缓存键版本pin-v2→pin-v3之后，实际最新构建新IAB标签首屏20篇；09.27真实展开完整尾段且无内容请求；滚动后第二页追加为40个不同slug。运行中的Next `.next/cache/fetch-cache` 记录首屏/第二页实际上游URL均包含protocol=pin-v3，pin-v3-build-cache-urls.json；最终交互回执pin-v3-smoke.json。其余已证实路径未重复固定套件。最终结果见 acceptance.md。

## 清理回执

主agent在最终截图与pin-v3烟检后明确通知可清理本轮DB/FS/配置与账号。Node stdin/pg再次确认 current_database 只等于 yoryon_reading_performance_20261014，记录本轮44内容/1用户/1剩余API会话/1权益及媒体计数于pre-cleanup.json；浏览器会话已真实logout，剩余会话来自本轮API协议登录。

```sh
# SIGINT只发给子agent自己启动的API session53625（graceful close，退出0）
docker exec deploy-postgres-1 dropdb -U postgres --if-exists --force yoryon_reading_performance_20261014
docker exec deploy-postgres-1 psql -U postgres -d postgres -Atc "select datname from pg_database where not datistemplate order by datname"
docker exec deploy-postgres-1 psql -U postgres -d yoryon -Atc 'select count(*) from contents'
```

dropdb退出0，数据库列表只有原有postgres/yoryon/yoryon_page_redesign_20261013；原yoryon内容仍7篇。Node stdin/pointers校验明确本轮临时目录名后，删除本轮FS、随机env/credentials/token、CLI输入复制目录与指针文件；其它preview/artifacts/build目录未删。自身三个IAB标签都关闭，临时viewport已reset，阻断已为空。cleanup.json留实际范围。

在删除秘密前，逐文件精确匹配本轮随机密码/API token/BFF/FS/cache secret/连接串：工件全部无命中；保留临时build536个非node_modules/.git文件也无命中。结果sensitive-scan.json。保留的临时build源码产物无本轮私密配置。
