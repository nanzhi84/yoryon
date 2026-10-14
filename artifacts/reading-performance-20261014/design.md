# 阅读操作优化

基线提交：288471a。主agent读取真实首页HTML/CSS/JS、公开详情与匿名BFF响应；下载回执 baseline/requests.json。2026-10-14 本机网络请求：9月27日帖子全文982字节(含DTO)约333ms，文章HTML约331ms。不是点击到绘制耗时，不据此宣称浏览器性能达标。

目标路径：首页列表 → 展开帖子/点击文章标题 → 完整正文；滚动接近底部 → 版本化游标分页 → 新条目。文章标题保留入口，删除重复“阅读全文”；favicon使用当前header头像。

边界与设计（实现前确认）：
- 当前feed的匿名许可正文按6个block/900权重截断，公开小帖子也需要点击后二次请求。仅无媒体、UTF-8不超过4096字节的public帖子随feed传入已许可全文，仍限制可见6块/32rem；每页20项最多约80KiB公开正文。大帖/媒体帖/付费预览保留服务端截断和按需权限核验。没有新增DTO字段、授权缓存或私有正文存储。
- 本地展开只切换裁切样式，Markdown子树保持挂载；服务器截断的帖子仍有15秒超时、取消、错误重试。focus/visibility清除已授权详情。不会把私有全文放sessionStorage。
- 文章链接只在hover/focus/touch意图时预取，加载状态及时反馈。保持staleTimes动态/静态均0和每次导航的当前revision门禁；不能以预取绕过下线/权限收紧。该约束限制“零网络”导航，浏览器真实收益需验收，不能宣称消除所有延迟。
- 自动翻页用600px底部预警、同步single-flight ref、15秒超时、卸载取消；先恢复同版本浏览记忆，再观察哨兵。错误停止自动重试；409/invalid_cursor停止并提示刷新；nextCursor=null结束，追加去重，不以同cursor无限取页。
- 日期格式移到纯lib，避免详情视图依赖feed组件。

预先识别失败方式：无网络展开、六块与高度双裁切、长帖/图片不完整、隐藏/焦点权限失效、重复intersection触发、分页恢复覆盖、超时/500重试风暴、409旧版本、末页、标题意图预取的下线后导航、错误反馈、移动触屏/键盘、favicon头像裁剪。独立子agent现场选择真实内容验证；浏览器连接目前超时，记录UNVERIFIED而非用HTML/200代替点击。

本轮不写固定测试程序或unit tests，使用隔离API/PG/FS、pnpm typecheck及pnpm build，工件保留环境/命令/回执。生产业务数据不写入；发布需另行确认。

最终入口设计修订：现场发现静态 ISR 会覆盖 middleware rewrite 的private/no-store头；该试验已失败并保留回执。canonical /p 改为动态page，middleware当前revision核验后覆盖x-yoryon-content-revision请求头，page只接受该UUID，通过headers()保持动态响应、React.cache合并metadata与page正文读取；不采用force-dynamic，因此revision-keyed公开DataCache仍有效。/render门禁/ISR不变。纯ContentDocument共用metadata与JSON-LD/正文，避免两个真实入口漂移。主agent新curl已确认canonical返回private,no-cache,no-store,max-age=0,must-revalidate。旧版预热后改paid现场未观测旧全文显示，不能称为已泄漏；实际修复对象是响应协议与重复rewrite导航请求。

滚动按pages保留批次，memo FeedBatch使新页不重新解析先前Markdown或读取先前互动；无进展非终止页报错暂停。图标png量化256色，源crop按页头50%/30%，保留16/32/48 ICO。最终源码与输入版本hash见source-manifest.json。
