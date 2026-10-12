# PR #20 / Issue #14 独立审查与现场验收

判定：**在下述实际覆盖范围内 PASS，无发现阻断合并的问题。** 审查 head `70d6dd52be833ae7f55f344e1b22783cbf8a0ae2`，base `24000316eb49dfdc9f66f4f3688b257a037eadda`，PR https://github.com/nanzhi84/yoryon/pull/20。结束前再读 HEAD，源码工作树干净。由主 agent 决定合并和记录 merge SHA。本报告不是部署验收。

2026-10-13，独立 agent `/root/cache_review`，使用 architecture-review 技能和一般代码 review。只读源码，未新增固定测试、harness、生产钩子或实现变更。现场操作使用临时内联命令与内置 IAB，工件保留实际结果。

## 环境和数据前提

使用交付 agent 已重建的生产模式 bundle，API `127.0.0.1:4323`，Web `localhost:3103`，PostgreSQL `localhost:54329/yoryon_accept_comments`，SMTP/Mailpit `11125/11126`。配置从 `/tmp/yoryon-accept-comments/env.sh` 载入，未打印。每次 SQL 连接前检查 host/port/database，拒绝其他库。0008 已由交付 agent 应用，未在本轮重跑迁移。服务未由本 agent 重启或停止。

基线包含其他隔离验收留下的 2 作品、48 评论和 3 用户，本轮保留。新建两名 `accept.invalid` 用户，经真实 BFF 注册、本地 Mailpit 验证、真实 LoginForm 登录；自身作品 `cmr14-review` 通过实际 publish CLI 发布。初始 22 根评论形成跨页场景，其后通过浏览器和 CLI/API 操作自然产生更多互动。只写隔离库，未发真实邮件。原始基线行仅在内存排序并哈希，工件不保存旧业务行、密码、验证码、会话 Cookie 或连接密钥。

## 当前 head 的独立现场结果

| 范围 | 判定 | 证据与实际可观察结果 |
|---|---|---|
| 注册/登录和评论 | PASS | `auth-and-roots.json`、`browser-ui-create.json`。本地验证后有真实会话；浏览器发送评论后正文可见、输入清空。 |
| 回复和点赞 | PASS | `browser-ui-reply-like.json`。第二用户真实登录，回复展开、显示被回复作者、根点赞 `aria-pressed=true`，无错误。 |
| 同一用户并发点赞 | PASS | `external-like-stale.json`。两次 PUT 均成功，SQL 只有 1 点赞、1 通知，根版本递增；不据请求成功单独判断。 |
| 外部点赞使旧分页失效 | PASS | `external-like-stale.json`、`browser-stale-recovered.json`。第一页原本未含目标根；外部点赞使目标升序，旧游标 409 `cursor_stale`；浏览器丢弃原排序、恢复首页、显示排序变化提示，目标升到首页。继续分页无重复。 |
| 失效恢复读取失败和重试 | PASS | `browser-reset-failed.json`、`browser-reset-retry.json`。仅在恢复首页的真实 GET 上通过 CDP 返回一次 503；可见刷新失败与重试，清除拦截后真实重试清错误、恢复新首页和交互。全部拦截规则已清除。 |
| 完整根序列 | PASS | `browser-sql-complete-sequence.json`。最终浏览器分页得到 25 个独特根 ID，无更多按钮；顺序与独立 SQL `like_count DESC, created_at DESC, id DESC` 完全一致。数量是核对手段，不单独当作业务成功。 |
| 通知入口/已读 | PASS | `browser-notifications.json`、`notifications-sql-boundary.json`。作者重新登录后角标 4；点一条通知跳到对应评论，角标 3；全部已读后同页角标 0，SQL 四条均已读。另一用户尝试 PATCH 作者通知 404。 |
| 退出会话/迟到计数 | PASS（有界） | `logout.json`、`browser-logout-late-count.json`。真实浏览器会话由 BFF logout 撤销，同一会话 me/count 401；延迟一次真实计数 200 响应，注销并页面导航后旧请求已取消，通知入口不再出现。没有强行把已取消的响应交付 JS；跨用户身份迟到请求的完整组合未穷举。 |
| API+BFF 流式大小上限 | PASS | `chunked-body-boundary.json`。无 Content-Length、每块最多 4096 字节的 JSON：恰好 32768 字节进入正文校验返回 400，32769 字节返回 413。空正文避免写入。 |
| 付费权限与撤销 | PASS | `paid-access.json`、`paid-revocation-soft-delete.json`。CLI 将自身作品改付费并授予自身用户内容权益；有权时正文含标记、评论/赞成功。CLI 撤销后新评论、回复、赞、取消赞均 403，正文无标记，历史讨论继续公开，未出现被拒绝正文的 SQL 行。 |
| 软删除 | PASS | `paid-revocation-soft-delete.json`、`browser-paid-soft-delete.json`。他人删除 403，作者即使当前无付费权益仍可删除自己的历史评论（文档明确的撤回语义）；根 DTO 正文/作者 null、deleted true，浏览器显示“评论已删除”，两条已有回复仍可读并显示“回复 @ 已删除”；对删除根点赞 404。 |
| 静态检查 | PASS | 本 agent 对冻结 head 执行 `pnpm typecheck`，exit 0，`typecheck.txt`。不代替业务验收。 |
| 构建 | PASS（交付旁证） | 读取 `comments-delivery-20261013/build-main2400031.txt`，交付 agent 对整合源码完成完整 `pnpm build` 并重启同一 bundle；本 agent 未重建共享运行目录。 |
| 清理 | PASS | `cleanup.json`、`private-file-cleanup.json`。自身用户、会话、评论/回复/赞/通知、权益/兑换/码、作品/版本/缓存事件与自身分析会话事件已删除；两封自身 Mailpit 消息清理后 404；九类基线表数量与 SHA256 完全一致，临时秘密文件及文章目录已删，IAB 临时标签关闭。 |

## 架构/源码审查

领域创建/回复/点赞/撤回在 core 收口；API 负责协议和 DTO，Web 私有点赞/context 与公开评论分离。评论会话状态不混入公开响应。通知只返回接收者的事件、作者名、标题和定位链接，不返回付费正文；下架与删除链接处理读过源码。

根游标绑定内容 ID、排序元组和 version，在一个短暂 repeatable-read 只读事务内读取 version、根和总数。0008 触发器将根新增/删除/排序字段变化与版本递增放在同一写事务，回复不改变根顺序；更新同一版本行有数据库原子序列化。前端 request generation/取消与游标拥有者检查，失效后改读首页，避免混合不同排序序列。持续互动时可能反复重载，已在 ADR 记录，适合当前博客范围。

写操作先锁目标评论，再按当前时间重新检查发布与权益；幂等点赞和通知事件唯一键的方向正确。通知已读以权威读取刷新；Bell 在 pathname/focus/已读事件刷新，取消旧请求并检查序号和 401。API 和 BFF 各自限制字节，跨两层不会仅相信 Content-Length。正文作为 React 文本渲染。主要手写文件 60–377 行，均小于 500 行，未发现职责/依赖方向破坏。

## 边界与没有扩张的结论

- UNVERIFIED：生产/目标网络部署、真实 SMTP、CDN、多实例运行、真实用户量下热版本行性能；本轮不构成上线证明。
- UNVERIFIED（本轮未重跑）：完整管理员删除、reply-to-reply 扁平化、跨作品回复、下架/重新发布、到期锁等待等组合。本轮读过对应源码与历史 r2–r5 工件，没有发现新增阻断；历史证据只证明各自记录的旧 head。r5 缺失两份历史 hash/safety 工件已由交付报告披露，未伪造历史结果。
- 现有产品没有注销按钮，本轮通过实际 BFF logout 撤销浏览器所属会话后观察页面导航；不声称 UI 提供了注销按钮。
- 首次 paid API 探查使用未知字段 `parentId`，该调用实际创建根评论而非回复；后续使用合同字段 `replyToId` 重做，SQL 确认 parent/reply_to 指向目标。重做后回执落盘路径错误，但 API 写入已发生；保留 SQL 事实，不把前一错误输入算回复验收。
- 工具操作失败如模块导入/列名、preview mode、Mailpit 路径均已纠正；清理第一次因 cache_events 的 text payload 上使用 JSON 运算符失败，事务断连回滚，然后按两条自身缓存事件 UUID 重做成功。没有重写旧业务数据。详见 `commands.md`。

主 agent 可在检查当前 PR head 仍相同、CI 和其余集成门禁后合并。若 head 改变，应重新界定审查范围。
