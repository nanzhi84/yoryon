# 信息流页面独立验收

结论：**本次本地页面与内容互动在下列真实路径内 PASS。** 背景与阅读区融为一体，日期在标题行，底部评论／点赞／转发可实际使用。验收发现的评论锚点缺失、网络失败英文提示，以及构建切换后评论首跳丢失 fragment，均完成修复并复验。此结论限定本任务隔离预览，不代表生产部署或所有浏览器／缓存情形。

独立验收 agent：`/root/feed_page_acceptance`。本 agent 没有修改实现文件或迁移，只写验收工件。实际使用专用内置 Browser 标签、真实 API/BFF 请求和 SQL 核对；没有新增单元测试、固定测试套件或可执行验收程序。

## 版本、环境与前提

- 基础 Git 版本 `b8e7098e941f80d899cd6483a9ce236732e5ddf6`，当前本地工作区改动；包含此前用户已确认的页面设计。源码/预览摘要见 `source-manifest.json`，运行环境见 `environment.json`。
- 最终 Web `http://localhost:3015/`（PID5757），API `http://127.0.0.1:4115`（PID87894）；仅本机回环。数据库严格核对为 `yoryon_page_redesign_20261013`，使用既有隔离 FS 存储。
- 起始数据为 7 篇真实本地演示内容、0 用户/会话/评论。本次新增两个隔离普通用户、自有评论/回复、临时草稿和权益事实；用户名邮箱使用 `example.invalid`，未向真实用户发邮件。
- 密码、会话令牌、数据库连接串和 BFF 密钥没有进入回执。凭据仅在 chmod 0600 的临时文件，结束后删除。
- 默认内置 Browser 1280×720，未修改主题或视口，也未复用/关闭用户已有标签。

## 实际结果

| 用户路径或边界 | 判断 | 实际证据 |
| --- | --- | --- |
| 单列背景、日期与三项动作 | PASS | 独立 computed style：body `rgb(253,254,255)`；阅读区祖先和所有 article 为透明、无围合边框；标题/日期在顶部，评论/赞/转发在底部，页面无水平溢出。`acceptance-page-measurements.json`、`acceptance-liked.png`。 |
| 游客点赞与真实登录 | PASS | 点击游客赞进入 `/login?returnTo=%2F`；用隔离账号实际填写并登录后回首页。`acceptance-guest-login.txt`、`acceptance-login.json`。 |
| 点赞、刷新保持、取消、键盘操作 | PASS | A 实际点击赞变为 `aria-pressed=true`、1赞；reload仍已赞，取消回0；Enter触发赞成功。`acceptance-liked.txt/png`、`acceptance-liked-refresh.txt`、`acceptance-keyboard-liked.txt`。 |
| 跨用户与游客状态隔离 | PASS | B 正常重新登录后看同一作品计数1、自身未赞；B点赞到2、取消回1；API/BFF顺序读取 A/B/游客的 liked 状态分别正确。`acceptance-cross-user.txt/png`、`acceptance-api-public.json`、`acceptance-ui-sql.json`。 |
| 幂等、并发与事实行 | PASS | A重复及8个并发PUT都返回1赞，SQL仅一行；A重复DELETE保持B的一赞；B的6个并发DELETE最终0行。`acceptance-api-public.json`。 |
| 批量接口约束与私有缓存 | PASS | 非法UUID、101个ID被400拒绝；重复ID去重；草稿/不存在ID不投影。身份读取和API错误 `private, no-store`；BFF不同Cookie/无Cookie状态没有串用户。`acceptance-api-public.json`。 |
| 付费权益 | PASS | 无权益、到期、撤销、未来开始均 canLike=false、PUT/DELETE拒绝403；有效内容权益和有效订阅权益可写；另一用户没有借用权益。`acceptance-api-boundaries.json`。 |
| 草稿、下架、删除与禁用用户 | PASS | 草稿/下架读空、写404；临时已发布内容获赞后删除，其赞级联清理；禁用用户现有令牌401，随后恢复。`acceptance-api-boundaries.json`。 |
| CSRF | PASS | 真实BFF写请求：外站Origin、无Origin/site、cross-site Fetch均403；same-origin Fetch成功；不会因携带验收Cookie绕过检查。`acceptance-api-public.json`。 |
| 评论计数 | PASS | 真实既有评论API创建根和回复后计数2；软删回复后1；最终清理后不保留测试评论。`acceptance-api-boundaries.json`。 |
| 最终评论首次导航 | PASS | 最终原生链接构建，刷新订阅页后第一次点击长文评论：`/p/demo-paid#comments`，scrollY953，评论区y547/高141可见（文档1673、视口720）。首页帖子第一次点击也保留 `/p/demo-audio#comments`，评论区起点y540可见。`acceptance-comment-native-final.json/png/txt`、`acceptance-post-native-final.json/png/txt`。 |
| 转发复制与无渠道统计 | PASS | 点击转发显示“链接已复制”，剪贴板为 `http://localhost:3015/p/demo-audio`；实际Meta+V粘进搜索框同值。操作前后CDP网络事件没有请求。`acceptance-copy.json`、`acceptance-copy-pasted.txt/png`。 |
| 复制失败的手动回退 | PASS（故障注入） | 当前本地文档临时令writeText拒绝NotAllowedError；页面显示手动链接，点击自动全选0..34，真实Meta+C后剪贴板同值。reload已移除注入、正常复制恢复。`acceptance-copy-failure.txt/png`、`acceptance-copy-manual.json`。 |
| 读取/写入失败与重试 | PASS | 仅本标签临时网络阻断：读取失败有中文提示、禁用赞、重试恢复；写失败不虚增且再次点击成功。修复后失败显示“网络请求失败，请重试。”。阻断恢复空列表。`acceptance-read-failure.txt/png`、`acceptance-read-retry.txt`、`acceptance-write-retry.txt`、`acceptance-write-failure-final.txt/png`。 |
| 用户/内容删除级联与清理 | PASS | 已登出、关闭本agent标签；删除自身2用户前尚有1条内容赞，删除用户后赞级联为0。自有会话、评论、权益、兑换、码、通知和33条本标签统计清理；自身所有剩余计数0，7篇演示仍published。临时凭据删除，69个工件扫描无敏感值命中。`acceptance-logout.json`、`acceptance-cleanup.json`。 |

## 已发现并修复的问题与证据解释

1. 最初 `#comments` 没有对应元素，实际scrollY0。现在内容评论区提供 `id=comments` 与滚动留白。旧失败证据保留在 `acceptance-comment-anchor.*`。
2. 最初网络写失败直接显示英文 `Failed to fetch`；现在仅透出受控API错误，网络异常使用中文。旧 `acceptance-write-failure.*` 与新 `acceptance-write-failure-final.*` 分别保留。
3. 加锚点后，构建切换的第一次 Next Link 评论导航仍出现 hash空、长文评论区y1500不可见。`acceptance-comment-tracked-final.*`、`acceptance-comment-anchor-final.*` 是**修复中间版本的失败证据**，不能用“元素存在”宣称导航通过。网络记录观察到RSC请求后整页GET丢失fragment；具体Next内部退化原因仍是推断。最终评论按钮改用带同一既有click/auxclick调用的原生锚点，首次导航真实通过，最终裁定只看 `acceptance-comment-native-final.*` 与 `acceptance-post-native-final.*`。

## 未覆盖范围

- UNVERIFIED：真实浏览器系统拒绝剪贴板权限本身；本工具不支持原生CDP权限覆盖，已验证的是本地writeText拒绝时的实际回退UI。未留下权限或文档覆盖。
- UNVERIFIED：其他浏览器/真实设备、慢请求15秒超时以及特定延迟下旧读写竞态；本次实测正常交互、即时网络失败/重试和数据库并发。跨页累计超过100项的客户端批次、collection/admin权益分支未单独造数据运行。
- UNVERIFIED：完整分析埋点统计口径；原生评论链接沿用既有send/auxclick代码，未重新验收全套统计。转发动作无请求已实际确认。
- UNKNOWN：生产部署、OSS/CDN和其他共享缓存表现。本次未访问/修改生产业务数据、未发送真实邮件。
- 主agent另行做真实媒体/播放器视觉检查，证据 `browser-visual.json`、`browser-audio.json`；本报告不把duration/readyState或静态构建成功当成独立播放业务证明。

## 复生成与清理

实际命令、环境和现场步骤见 `acceptance-commands.md`。复验需要仍可用的隔离DB/FS与临时preview.env，重新创建自身验收账号并经真实登录；不能使用已删除的凭据或将旧回执当当前测试入口。

本次只清理自有验收数据，保留本地Web/API与7篇真实演示用于用户预览。没有关闭其他标签或服务。最终销毁预览环境时由主agent另行核对对应PID和隔离库范围。
