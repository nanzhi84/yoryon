# 工作区提交与生产发布

用户授权：本次工作区commit+push origin/main，然后部署生产。基线14982a7，包含本轮会员作品按合集聚合、实时版本缓存、章节返回合集、既有设计及交付验收工件。已合并未部署的访客身份/合集连续阅读/帖子阅读统计一同进入本次生产版本。

独立发布审阅无阻断，见 independent-release-review.md。本轮实现的本地真实CLI/API/浏览器验收见 ../member-collection-display-20261015/ 与 ../collection-preview-feedback-20261015/。本地测试账号、示例内容、长简介、封面没有生产发布动作。

部署目标：Aliyun既有主机 /opt/yoryon，API Docker linux/amd64；Vercel既有Hobby项目 yoryon-web，rootDirectory=apps/web。域名 yoryon.com / api.yoryon.com。没有创建新项目或更改付费计划。

发布前：生产API镜像66fb2580fa0beee799e9def1ed0dea01957febf4，Vercel当前7124e919511e27c97c9a6417a92097aae5a1ce3a。生产迁移账本13条，尚无analytics_visitors/visitor_id/show_in_home/is_pinned。实际业务25内容、0合集；统计事件数量随自然访问变化。

生产备份 /var/backups/yoryon/20261015T035201Z，20个OSS对象完成内容校验。数据库与媒体压缩包SHA256复核通过，敏感备份仅保存在生产主机受保护目录。工件只记录路径、权限、大小与回执，不复制生产私密备份或env。

顺序：提交推送→构建镜像→linux/amd64原生运行核对→上传镜像→正式migrator执行0013/0014及派生投影→新表最小权限→API切换及语义核对→Vercel生产构建但先不绑域→预发布核对→promotion→独立生产验收。

回滚：保留旧镜像，恢复/opt/yoryon/.env的YORYON_IMAGE为rollback-baseline.txt中的镜像再compose up -d --wait api；Vercel promote vercel-before.json原部署。新增列/表兼容旧运行版本，不自动删表或回滚业务数据；必要的数据恢复应先在隔离库验证备份。本次不发布文章或示例。

实际命令、版本、镜像摘要、部署ID与验收结果在本目录后续回执中记录；本文件不把计划视为已完成。
