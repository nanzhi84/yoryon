# 独立发布审阅（部署前）

日期：2026-10-15；只读审阅源代码和本地验收证据，无生产写入或邮件。
结论：本次会员目录/章节返回工作区变更未发现发布阻断。

核对范围：member-feed.ts、app注册/auth公开线、Web BFF与版本页代理、MemberFeed DTO、MemberTimeline、LoadMore、subscription首屏fetchCatalog、article-feed/post-feed公开投影、ChapterBackButton/共享ChapterContext、ADR0019，以及上一轮独立API和主agentBrowser/独立截图审阅回执。

- 合集先聚合后分页，已发布条件同时作用计数与paid准入，独立paid用not exists排除任何合集归属；UUID/kind共同构成游标顺序，毫秒转换与序列化一致。repeatable-read中版本与条目一致。
- 公开线不读取会话；独立作品摘要/短帖只复用publicPreview后的投影；付费全文门禁未改变。匿名sentinel、混合集计数、多归属、27条跨页、无漏重与真实发布后旧version409已有独立API证据。
- 首屏实时版本门禁，追加页409/invalid_cursor提示刷新；AbortController、15秒超时、失败暂停与手动重试保留。LoadMore仍只允许member-feed返回合集条目，首页/标签未混入合集。
- 章节返回用已验证context生成目录Link；无效context回原BackButton；加载禁用、错误retry；未使用未经验证query直接跳合集。实际第一篇→下一篇→顶部目录及flow由主agentBrowser完成，截图/回执独立审阅。
- 新增/现有本地工件定向扫描未发现明文测试密码、DATABASE_URL值、SESSION_SECRET值、Bearer凭据或sk-proj；提交前仍应主agent对最终staged全集检查。

部署依赖：先API后Web，避免新Web请求旧API member-feed404。此次无新DB迁移；先前已合并未部署#28/#29/#30会随runtime一起发布，主agent需按其部署/迁移约束核对，本审阅不把既往源码验收当生产验收。

非阻断未验证：网络失败重试的现场Browser路径、跨kind完全相同UUID与时间边界、生产数据规模/性能；生产新runtime尚未独立验收。上一轮主agenttypecheck/build通过属于静态证据，不能代替生产路径。
