# 页面重设计独立验收

结论：**本次本地重设计在下列实际路径内 PASS，没有发现阻断用户预览的问题。** 头像、浅蓝色系、克制订阅面板、导航和会员页面的主要状态均实际可见。该结论限于本地隔离环境，不代表生产上线或全部业务验收。

验收代理没有修改生产代码。桌面操作由独立验收代理通过原生 CUA Chrome 新建隐身窗口执行；子任务的内置 Browser 与 Chrome browser surface 均不可用。390/320 移动宽度及深色动作由主代理按独立验收代理选定的操作执行于根任务内置 Browser，保存未经结论加工的截图及 DOM 测量；独立验收代理逐张查看工件并自行判定。没有借用用户已有浏览器标签或登录状态。

## 版本与环境

- 基础 HEAD：`b8e7098e941f80d899cd6483a9ce236732e5ddf6`，本次页面工作区变更未提交。
- 预览 Build ID：`R6m5f7vPngLBeNx0GYwWg`。源码副本 `/tmp/yoryon-page-redesign-m0NxxV/workspace` 的9个修改页面文件及头像与当前仓库逐字节一致，哈希见 `acceptance-version.json`。
- 隔离 API `http://127.0.0.1:4115`，同一已构建产物 Web `http://localhost:3015`，监听127.0.0.1；PostgreSQL `localhost:54320/yoryon_page_redesign_20261013`，FS `/tmp/yoryon-page-redesign-m0NxxV/storage`，本地 Mailpit11025/18025。
- 来自已确认本地 Colima Docker 的7篇demo作品、媒体、合集和标签，未复制任何原用户、密码、会话、验证码、权益、激活码、评论或统计。迁移重建公开投影成功。
- 主代理实际执行 `pnpm typecheck`、最终 `pnpm build` PASS；静态/构建结果独立于下面的业务判定。构建副本保留原有3101服务的产物。

## 实际结果

| 范围 | 判定 | 结果与证据 |
| --- | --- | --- |
| 头像原图与CSS裁切 | PASS | 用户指定原图、仓库 `public/images/author-avatar.jpg`、Web静态原图均为2303380B且同一SHA-256 `ea6a595c414948ea999b977baec292715fa39dbeee761c618d8a21d5990f4578`；HTML引用Next Image 48/96px源，`rounded-full object-cover object-[50%_30%]`，桌面及手机实际看到圆形头像。96px、q75优化响应2056B，详情 `avatar-bytes.json`。 |
| 已批准v3视觉落地 | PASS | 对比第三版设计图与真实页：浅蓝灰外围、近白阅读面、蓝灰强调、细边框、小面积浅蓝订阅面板；没有夸张深色会员卡。真实demo排序及媒体采用实际本地数据。桌面截图 `browser-home-desktop.png`、`browser-subscription-desktop.jpg`。 |
| 两行导航与搜索/通知/探索 | PASS | Browser搜索“示例”实际返回两篇，点击第二话进入完整正文与合集上下篇；探索→合集看到真实示例系列；匿名通知进入 `/login?returnTo=%2Fnotifications`。390截图分别显示搜索弹窗、账户与探索菜单完整且可读。 |
| 兑换登录returnTo | PASS | 订阅CTA→`/redeem?returnTo=%2Fsubscription%23membership`→嵌套登录returnTo→登录后回同一兑换页→真实兑换后回 `/subscription#membership`。没有凭HTTP状态单独判定成功，最终实际显示“我的会员/已开通/截止/剩余1次”。 |
| 会员未开通/有效/到期 | PASS（当前数据前提） | 隔离账号通过BFF注册与本地Mailpit验证；未开通有紧凑CTA与“我的问答”；CLI生成30天码、Browser兑换后截止与SQL一致。仅将本轮自有权益区间调整为已到期，再实际刷新，回未开通面板且提问表单消失。见会员TXT/PNG、`membership-expiry-premise.json`。 |
| 付费文章视图 | PASS | 有效会员真实进入demo-paid，见完整后半正文、视频入口和评论输入；到期后刷新只能看公开截断、兑换提示，付费视频与评论输入消失。见 `browser-paid-active.txt`、`browser-paid-expired.txt`。 |
| 会员加载失败与重试 | PASS | 仅在隔离库临时将entitlements改名，登录页面的真实会员请求500，UI显示“会员状态加载失败”及重试；立即恢复表名后点击重试，同页恢复相同会员截止与剩余次数。问答自己的“刷新列表”也实际恢复。见 `browser-membership-failure.*`、`browser-membership-retry.txt`。没有生产钩子或伪响应。 |
| 390与320宽度 | PASS（浏览器缩放视口） | `scrollWidth=clientWidth`，分别375/305（15px滚动条），header分别343/273px，均在内容边界内；320订阅面板280.25px高，价格自然折行、按钮和说明完整。两行导航没有溢出或重叠，首页提示在320自然折行。见 `mobile-measurements.json`及手机截图。 |
| 深色模式 | PASS（手动切换） | 实际UI切深色，头像、正文、按钮、蓝灰面板和分隔线仍清晰可读；独立看图见 `browser-subscription-dark-390.jpg`。主代理随后通过UI恢复浅色桌面预览。 |
| 首页媒体入口 | PASS（挂载、停止关闭与可见元数据） | 本人Browser点击首页音频后真实播放器显示3秒时长；再点视频后音频播放器卸载回入口，视频显示4秒元数据。根Browser随后按本人指令点视频再点“停止并关闭视频”，原始回执为duration=4、readyState=4，关闭后videoElements=0且播放视频入口恢复为1个；本人独立核对AX与JSON判断该边界PASS。截图/回执 `browser-audio-mounted.png`、`browser-video-mounted.*`、`browser-video-closed-final.txt`、`browser-video-metadata-final.json`。 |
| API仅回环重启后的最终可见 | PASS（匿名预览） | 本人确认最终API4115和Web3015皆只监听127.0.0.1；根Browser按本人指令在重启后实际重载首页与订阅，本人独立查看最终截图及回执：首页demo媒体/文章/订阅提示完整，订阅页显示紧凑浅蓝CTA及会员作品，头像loaded=true。见 `loopback-restart.json`、`final-browser-receipts.json`、`browser-home-final.jpg`、`browser-subscription-final.jpg`。 |
| 数据清理及预览保留 | PASS | 本轮1用户、2会话、1验证码、1激活码、1权益、1兑换及12条本轮统计清理后为0；自身Mailpit邮件DELETE200并GET404，临时故障已恢复，私密测试凭据文件已删除。工件精确敏感值扫描未泄漏密码/激活码。隐身验收窗口关闭；根Browser仍匿名浅色桌面预览。服务、隔离库和7篇公开demo暂保留给用户。见 `cleanup.json`。 |

## 未覆盖范围

- UNVERIFIED：真实手机硬件与其他浏览器；跟随系统的自动主题切换。这里验证390/320视口以及用户菜单手动深色。
- UNVERIFIED：真实时钟跨会员到期/跨月、页面长期停留期间的自动权益变化；到期是自有隔离数据前提并经真实重新加载验证。
- UNVERIFIED：本轮没有提交会员问题、回答、讨论、通知互动或并发额度，只有表单状态、公开/我的问答空态与失败恢复。
- UNVERIFIED：音视频实际声音、持续播放、拖动、签名失效/重试、所有媒体字节及GC。这里的媒体结论仅为实际挂载、时长和切换卸载；头像已单独做完整原图字节及优化响应核对。
- UNKNOWN：生产部署、OSS/CDN缓存、真实邮件或生产设备最终表现。本轮未访问、修改生产业务数据，也未向真实用户发送邮件。

## 复现与回收

环境准备和实际命令见 `acceptance-commands.md`；预览打开首页/订阅/文章后按上表真实用户步骤重新操作即可。故障SQL和清理SQL只允许明确的本轮隔离数据库。

预览结束后，先核对 `/tmp/yoryon-page-redesign-m0NxxV/api.pid` 与 `web.pid` 对应命令为本轮4115/3015进程，再停止这两个PID。随后从本地管理连接执行 `DROP DATABASE yoryon_page_redesign_20261013` 并删除临时运行目录；不要删除原 `yoryon` 库、`.storage` 或其他服务。当前尚未执行最终销毁，用户仍可预览。

收尾补充：独立验收代理已经查看API最终回环重启后的两张真实Browser截图和首页媒体关闭前后的原始AX/JSON。关闭后视频元素确实消失并回到“播放视频”入口，最终两页面与先前已验收设计一致，头像实际加载；这两个原先待补充边界均改为PASS。根任务仍只提供操作证据，判定由独立验收代理完成；其他未验证项保持上文范围。

最后Browser检查追加的隔离匿名统计已再次清空，回执见 `cleanup.json` 的 `finalBrowserSweep`；7篇demo及预览服务保留，此后不再执行Browser验收动作。
