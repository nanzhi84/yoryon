# 工作区提交与生产发布

用户授权：本次工作区commit+push origin/main，然后部署生产。基线14982a7，包含本轮会员作品按合集聚合、实时版本缓存、章节返回合集、既有设计及交付验收工件。已合并未部署的访客身份/合集连续阅读/帖子阅读统计一同进入本次生产版本。

独立发布审阅无阻断，见 independent-release-review.md。本轮实现的本地真实CLI/API/浏览器验收见 ../member-collection-display-20261015/ 与 ../collection-preview-feedback-20261015/。本地测试账号、示例内容、长简介、封面没有生产发布动作。

部署目标：Aliyun既有主机 /opt/yoryon，API Docker linux/amd64；Vercel既有Hobby项目 yoryon-web，rootDirectory=apps/web。域名 yoryon.com / api.yoryon.com。没有创建新项目或更改付费计划。

发布前：生产API镜像66fb2580fa0beee799e9def1ed0dea01957febf4，Vercel当前7124e919511e27c97c9a6417a92097aae5a1ce3a。生产迁移账本13条，尚无analytics_visitors/visitor_id/show_in_home/is_pinned。实际业务25内容、0合集；统计事件数量随自然访问变化。

生产备份 /var/backups/yoryon/20261015T035201Z，20个OSS对象完成内容校验。数据库与媒体压缩包SHA256复核通过，敏感备份仅保存在生产主机受保护目录。工件只记录路径、权限、大小与回执，不复制生产私密备份或env。

顺序：提交推送→构建镜像→linux/amd64原生运行核对→上传镜像→正式migrator执行0013/0014及派生投影→新表最小权限→API切换及语义核对→Vercel生产构建但先不绑域→预发布核对→promotion→独立生产验收。

回滚：保留旧镜像，恢复/opt/yoryon/.env的YORYON_IMAGE为rollback-baseline.txt中的镜像再compose up -d --wait api；Vercel promote vercel-before.json原部署。新增列/表兼容旧运行版本，不自动删表或回滚业务数据；必要的数据恢复应先在隔离库验证备份。本次不发布文章或示例。

实际命令、版本、镜像摘要、部署ID与验收结果在本目录后续回执中记录；本文件不把计划视为已完成。

## 最终发布结果

应用提交2679777df17d026a655faa1f63c83eebde0308d9已推送origin/main。全部本轮源码、设计与验收工件一起提交；新增发布证据单独提交，不改变应用源码。typecheck PASS；完整隔离构建见前轮member-collection-display/build.log；本轮Docker生产镜像构建及Vercel实际生产构建均PASS。

镜像 yoryon-api:2679777df17d026a655faa1f63c83eebde0308d9 已上传并切换，健康且重启0次。native-runtime.json记录实际linux/x64 WebP转换、argon2哈希验证；runtime-bundle-hashes.json与server-runtime-hashes.json逐字一致，证明运行的应用与迁移字节匹配构建产物。

生产正式migrator完成0013/0014与25条派生投影，账本15条。新analytics_visitors表API角色获得SELECT/INSERT/UPDATE（实际upsert需要UPDATE），CLI仅SELECT；旧统计没有历史visitor回填。25篇业务内容指纹完全一致，9article/16post全为public/published，show_in_home初始化保持原首页可见性。没有发布本地示例或测试账号。

前端来自2679777的git archive临时源码快照，避免把本地未跟踪配置/草稿发给部署构建；复用既有Vercel项目。dpl_CqBbP81RxdAQsFYFm2gagznfFwem READY，临时地址受Vercel保护，通过已有授权vercel curl检查真实首页、订阅和合集空态、新BFF会员目录后promote。未更改Deployment Protection或Trusted Sources规则。domain-after.json确认yoryon.com实际alias绑定此新部署；deployment-final.json记录commit与READY状态。

独立生产验收见independent-production-acceptance.md：新BFF、首页两页25唯一条目、article/post正文及实际CSS/JS字节、15迁移与权限、真实Compose CLI均PASS。首次尝试docker run --env-file绕过Compose对引号的解析导致NaN，这是验收命令差异；已用项目真实docker compose run cli流程复验PASS，没有为此改动生产配置。

主agent真实内置Browser完成首页→先自由后财富正文→顶部返回首页→订阅页会员作品空态，截图经独立子agent审阅。自然访问后匿名访客账本及带标识事件已有记录；只查聚合，不读cookie/标识明文、不发送合成事件，不将匿名标识数解释为人数或归因于全部本次测试。

api-error-scan.json为容器启动至最终浏览器核对窗口，未见error或HTTP5xx；vercel-error-scan.json为新部署最近15分钟error日志0条。它们仅代表有界观察，不能代表长期没有故障。

生产当前没有合集或会员作品，因此真实生产合集聚合/跨章返回和会员解锁路径UNVERIFIED；前轮隔离本地真实用户路径PASS保留其环境边界。没有创建生产测试账号、发信或支付操作。备份恢复演练、会员回访首次时间更新仍未在本次生产验收。

当前正式URL：https://yoryon.com 。回滚镜像及旧Vercel部署仍保留。临时验收3027/4127已停止清理，本地预览3000/4116继续运行。
