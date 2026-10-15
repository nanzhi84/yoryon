# 统一入口独立验收

状态：**PASS（本次受影响业务路径与最终构建小修复复核）**。无已发现 FAIL。

验收者仅准备隔离环境、现场执行浏览器/CLI/API/SQL，不参与生产源码实现。主 agent 的构建与类型检查是独立静态证据，本报告没有用构建、HTTP 200或数量单独证明业务通过。

## 最终设计范围

用户最新澄清覆盖早期纯文字设计：**首页仅文章；文章/合集统一4:3封面或缺图占位；合集只文章；帖子独立到 /posts，保留原有多媒体与原地展开/收起。** 导航首页→帖子→合集→订阅，探索向下。

## 实际结果

| 范围 | 结论 | 证据与观察 |
|---|---|---|
| 首页及分页 | PASS | 浏览器滚动从20条加载到24条；API跨页ID及顺序与隔离SQL一致，无重复、无帖子；无描述文章回退正文摘要。 |
| 文章/合集视觉 | PASS | 桌面112×84、手机88×66（4:3）；有图/缺图占位均统一；标题与封面同顶；日期在文字下方；390px长标题及导航无横向溢出。 |
| 帖子列表 | PASS | /posts首屏20条、滚动24条；show_in_home=false帖子25不出现；第二页媒体only帖子24直接显示图片；首页不出现帖子。 |
| 原地展开/收起 | PASS | 多媒体帖子01展开后图→视频→音频→末段顺序完整，可收起；文字帖子03本地展开未请求详情；长帖子04远端展开拿到全文末尾。 |
| 失败重试 | PASS | 浏览器临时阻断post04详情请求，显示“帖子加载失败。重试”；解除阻断后重试全文出现并可收起。没有添加生产测试钩子，阻断已清除。 |
| 离页取消 | PASS / UNVERIFIED | 已见“加载中…”后导航首页且没有晚到UI更新。CDP没有记录该fetch的abort回执，因此不声称传输层取消已被独立证明。网络延迟模拟已归零。 |
| 匿名/权益边界 | PASS | 匿名付费post02展开仅公开预览，隐藏文字/音频缺席并显示预览提示；通过真实登录后有单篇权益的同一帖子展开显示完整正文和音频。API匿名隐藏媒体403，权益请求拿到与源完全相同的字节。 |
| 文章详情媒体 | PASS | 由合集“开始阅读”实际进入文章01，图片/视频/音频及末段完整。点击播放后音频、视频均duration=2秒、readyState=4、无decode error。 |
| 媒体字节 | PASS | 公开图片、视频、音频SHA256等于冻结源；视频Range bytes=0-31返回206且32字节相同；付费音频授权字节相同。 |
| 合集边界 | PASS | 两个合集原数据库均article+post，关系共4条保留；列表各1篇、目录只有文章，文章上下篇导航均不含历史帖子；旧帖子章节接口404；帖子详情collections为空。 |
| CLI写入边界 | PASS | 当前CLI发布post.collections明确拒绝，退出1；合集sort帖子也退出1；历史关系未删除。 |
| 游标失败 | PASS | 错用另一类型游标400、无效游标400、旧版本409；正常跨页对齐隔离SQL完整排序。 |
| 返回/统计 | PASS | 第二页文章进入详情后返回保留24条已加载列表与所选卡片位置；真实浏览器事件落库post impression/read的placement为post_feed，没有post详情view/read。 |

## 工件

- `environment.md`、`reproduction.md`：版本、隔离前提、实际命令与可复现顺序。
- `api-path-results.json`、`browser-observations.json`：现场观察结果；`isolated-data.sql.txt`、`final-relations-analytics.sql.txt`：隔离SQL回执。
- `cli-*.log`、`migrate.log`、`api.log`、`web.log`：CLI与进程回执。web.log保留一次错误Next路径后的成功启动，非产品FAIL。
- `home-desktop.jpg`、`home-mobile.jpg`、`collections-desktop.jpg`、`collections-mobile.jpg`、`posts-desktop.jpg`、`post-expand-failure.jpg`、`post-anonymous-preview.jpg`、`post-member-expanded.jpg`、`article-media-detail.jpg`：实际浏览器截图。
- `source-content.tar.gz` 为历史冻结内容输入（去重归档）；不是可执行fixture/harness，也不是当前CLI可直接发布的格式。`source-byte-manifest.json` 记录每个输入文件字节校验；`data-manifest.json` 记录隔离数据角色。

## 未覆盖

- UNVERIFIED：生产部署、生产数据库/对象存储、生产缓存投递/TTL、真实读者/通知邮件、实际浏览器的所有设备和长时间播放、过期权益与并发撤权。
- UNVERIFIED：远端展开请求离页后的底层传输abort回执；已独立确认UI没有晚到更新。
- UNKNOWN：未检查的生产历史内容构图是否适合中心裁切；此次只验证视觉占位与展示规则，不重制封面资产。
- 保留原实现：短付费公开预览未被列表折叠时可能没有“展开”按钮，可由日期进入详情；未将这项既有行为误记为本次回归。

## 清理

最终构建已重新启动并独立复核：文章封面和缺图链接均有“查看文章：标题”可访问名，尺寸仍112×84；缺图article02封面可进入正确详情及权益音频。最终截图home-desktop-final.jpg。已关闭独立验收标签并恢复临时网络/viewport设置；停本次3115/4215进程，删除专用容器与tmpfs数据库、FS、credentials、私有env、临时workspace和内容副本。端口无监听、容器不存在、临时根目录不存在均已复核；原3000监听保留。详见cleanup.json。没有待执行验收项；线上预览已结束，以冻结截图和复现步骤复查。未触碰生产数据、用户现有3000服务、既有数据库或既有浏览器标签。

最终源码冻结参照主目录source-manifest.json，SHA256：`0ff14f9f1590427c646ee28b25bfdfde4c82bf19bfe5d2709c479124c62cdac6`。验收报告只声明已执行范围，不将源码相等或静态构建代替运行结果。
