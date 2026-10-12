# Issue #15 / PR #22 独立验收

**结论：最终源码没有已知阻断项；本轮隔离业务路径通过。** 原交付的两个具体缺口（上下篇未渲染、问答通配32KiB限制污染头像）均实际复现、由实现代理修复并独立复验。该结论不代表生产部署、真实跨月时钟或所有设备已通过。

- PR：https://github.com/nanzhi84/yoryon/pull/22
- 业务验收最终源码：`17c09e45895646643bd2bad41830ee3bff7fedc5`。
- 初始整合源码：`864a0874b562cd62c3598b95c656b37fdeb0985f`（与61f1296全树一致）；上下篇修复：`c25759c76f3eb301c974069bf7feb2ae6a0e3439`；头像边界最终修复：17c09e4。
- 合并：GitHub读取确认PR的 headRefOid 为17c09e4，merge `ab13db42e975adf4fbddb16ca8c660c3bbd0daf5`，mergedAt `2026-10-12T18:34:59Z`。
- 合并后实现分支又增加 `98ad7f340a740d7695060cc4e822818d082f7d6d`，只修改交付报告delivery.md元信息，源码与17c09e4相同；没有把这次工件更新冒充另一套业务验收。

环境：macOS，独占空库 `127.0.0.1:54320/yoryon_member_20261013`，0–9迁移；FS `/tmp/yoryon-member-20261013/storage`，API4160 / canonical Web `127.0.0.1:3160`，本地Mailpit11125/11126。实际创建24个自有accept.invalid账户，真实BFF注册及邮件验证，真实CLI发布3篇自有作品、grant与激活码，真实兑换和22次成功提问。没有生产写、真实用户邮件、固定测试脚本/fixture/harness；现场临时操作和原始输入只作为历史工件。命令、故障前提及更正见 [commands.md](commands.md)，架构见 [architecture.md](architecture.md)。

## 实际业务结果

| 范围 | 状态 | 可核对证据 |
| --- | --- | --- |
| 免费首页/单个置顶/付费订阅流/合集与标签 | PASS | browser-home-canonical、browser-explore-canonical、browser-collection-after-fix、sql-summary；首页只有两篇免费且旧日期自我介绍独占置顶，合集3篇顺序及上下篇首尾正确。 |
| 兑换登录returnTo/会员截止 | PASS | browser-redeem-return：CTA→LoginForm→RedeemForm→subscription#membership；actual SQL连续续订真实截止；browser-return-to-rejected：外站参数回站内首页。 |
| subscription、单篇/合集权益分离 | PASS | monthly-concurrency、browser-content-only：单项授权能读对应付费作品，但会员状态未激活、不能提问/读其他回答或讨论。 |
| 每月额度并发与续订 | PASS（当前月） | 同账号两个真实并发提交201/409，SQL1行；续订后remaining仍0；全部实际问题无重复user/month。 |
| 公开/私密/隐藏/历史回答/撤销与过期 | PASS | question-permission-matrix、revoked-expired-hidden、final-permission-headers：匿名/撤销/单项权益无答案或HTML标记；有效其他会员可读公开答案；私密/隐藏仅本人/管理员；本人到期仍读历史回答。 |
| 讨论、回复、点赞、通知及失效后的旧链接 | PASS | browser-discussion-*、browser-notification-anchor、privacy-transition-and-notifications；实际回复通知点入准确锚点并展开，跨问答回复400；private/hidden或撤销后roots/replies/locate/write/like拒绝且旧互动notification.link=null。 |
| 最近活动分页/并发/重试 | PASS | 20个新增账户逐一真实兑换提问；第一页20，外部点赞旧游标409，浏览器提示刷新后最终21唯一ID与SQL实际集合一致；ConnectionFailed错误/重试恢复，CDP拦截已清除。 |
| 展示名、当前资料和公开DTO | PASS | browser-profile、discussion-and-profile-boundaries、privacy-transition-and-notifications；历史评论/问答/通知显示当前资料；越界/控制/双向字符/HTML尖括号拒绝、私有字段不输出。 |
| 头像上传字节、安全边界 | PASS | avatar-large-before-fix保留原FAIL；body-boundaries-after-fix及browser-avatar-final：同一166517B图最终API/BFF/UI成功、实际320px图已加载；WebP无EXIF，MIME伪装/SVG/动画/16004000像素拒绝；流式2MiB允许、+1拒绝。 |
| 头像共享引用、GC与失败孤儿 | PASS | avatar-bytes-gc：同字节dedup、仍被另用户引用保留、失效引用删除；GC持锁skip和上传等待；avatar-real-failure-orphan-gc：真实5秒DB锁超时500留下对象/DB0行，经30h年龄前提实际GC删除，当前引用保留。 |
| API/BFF body和缓存界线 | PASS | body-boundaries-after-fix：questions32KiB参数400/+1为413，头像2MiB为200/+1为413；final-permission-headers：身份成功/401/404、公开图片拒绝no-store，feed与公开作品仍公共策略。 |
| 静态/构建/迁移 | PASS（各自范围） | 本人最终`pnpm typecheck` exit0；服务代理最终`pnpm build` exit0，frozen-version记录bundle hash与BuildID，并用该bundle完成实际浏览器/API验收；空库迁移0–9成功，不把它们计为业务完整。 |
| 清理 | PASS | cleanup：14个基线业务表计数+行哈希恢复，全部20个public业务表0；24封本轮邮件逐个404，两个最后使用的头像对象删除，失败孤儿已另由GC删除；本轮浏览器已关闭。 |

## 未覆盖项与范围

- UNVERIFIED：真实服务时钟跨上海自然月的端到端推进。本轮只以实际导出monthKeyShanghai核对月底/年末前后一毫秒，并实测当前自然月并发与续订。
- UNVERIFIED：生产OSS身份权限、OSS头像上传及GC、生产CDN/Vercel跨区域行为、真实邮件、正式部署后的设备/网络验收；这里仅使用FS及Mailpit。
- UNVERIFIED：已有业务数据现场升级0008→0009和代码回滚运行。本轮是空隔离库完整迁移；独立源码审查确认旧content评论默认target_kind/可空字段/XOR兼容与历史多置顶收缩规则，没有冒充存量迁移验收。
- UNVERIFIED：长期停留页面而不刷新时的自发会员到期显示更新、旧请求人为迟到覆盖、所有移动设备。已验证实际重新加载后的撤销/到期界面及服务端权限、scope取消设计和一次网络失败恢复。
- UNKNOWN：上述目标环境的最终运行表现，必须部署后用对应环境证据决定；本轮没有这些现场数据。

工件包含原失败和操作错误更正，不删掉不利回执。最终回答矩阵第一次执行在后续错误列名SELECT前未保存局部回执，已明确披露并重新执行矩阵、重复CLI回答及正确SQL核对。敏感精确值扫描未发现密码/会话/激活码；`SHA256SUMS`可校验全部历史输入、响应、截图和报告。
