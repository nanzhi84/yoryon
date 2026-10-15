# 会员作品聚合与长简介本地交付

目标：会员作品区以合集为单位展示归属章节，独立会员作品单列；解决原订阅首屏不按目录版本选择缓存而漏掉新作品的问题。用户明确选择了“合集聚合＋独立作品”。架构边界见 docs/adr/0019-member-collection-catalog.md。

## 版本与环境

基线 HEAD 14982a7ad0af60096adb321a399d12a23244472f，加当前未提交工作区变更。当前预览 http://localhost:3000/subscription；API4116；隔离开发数据库 yoryon_page_redesign_20261013，本地fs存储。配置 /tmp/yoryon-local-preview-20261015.env，0600，不入工件。没有生产写入、发邮件或权益授予。

用户数据：editorial-preview简介扩展为约300字（before.json留原文）；保持8篇，其中1篇会员。用户请求的预览数据保留。目录里简介完整自然换行，会员列表保留三行摘要。

## 实际检查

- pnpm typecheck：PASS，typecheck.log。
- pnpm build：PASS，build.log；临时工作副本继承隔离API配置，NODE_ENV=production，pnpm_config_verify_deps_before_run=false（只关闭副本依赖重装检查），避免扰动运行中dev的.next。
- git diff --check：PASS。
- 独立子agent使用新建DB/API4127做聚合、草稿、多合集、分页、400/409、公开正文隔离；详见 independent-acceptance.md 与独立回执。临时数据不在主preview。

## 主agent实际浏览器路径

内置 @Browser，由首页点击订阅，会员作品区实际显示长文排版预览合集（共8篇/1篇会员）及独立付费演示文章。合集中的 editorial-paid-example不重复单列；点击合集标题实际进入/c/editorial-preview。subscription-desktop.jpg为当时默认539px视口，subscription-375.jpg为375px；后者scrollWidth360，无横向溢出，合集摘要实测72px（3行）。

合集详情704px：简介完整显示，高240px，scrollWidth689；375px：高528px，scrollWidth360，仍完整换行。均不截断或新增折叠。截图 collection-long-704.jpg、collection-long-375.jpg。

独立临时库重建后，Web3027→API4127（env仅/tmp）现场验收分页：打开/subscription，首屏20条，向下滚动触发LoadMore。最终真实DOM为26个article和26唯一href=1合集+25独立作品，无合集内2篇章节重复单列；browser-paging.json记录全部可见业务条目，paging-second-page.jpg显示末页结果。

随后执行真实CLI更新合集：
`node --env-file=/tmp/yoryon-member-accept-20261015.env --import tsx apps/cli/src/index.ts collection create accept-collection --title '隔离会员合集（已更新）' --description '由真实CLI更新，用于检查会员发现目录在缓存未推送时选择最新版本。'`

push未配置，事件pending。刷新浏览器实际显示新标题，catalog version从全零变为45792014-b6fa-4905-b963-2e3fe0e74539；browser-refresh.json与publish-refresh.jpg为证据，命令回执在publish-refresh-command.log。不是仅据HTTP状态或SQL计数判断更新成功。

临时Web3027已SIGINT退出，Web私有配置已删除，临时浏览器标签已关闭；独立agent负责API4127与临时库最终清理。主预览3000/4116继续运行。

复现当前交付：打开/subscription→检查合集汇总→点击合集→查看长简介与免费/会员目录。分页数据关系与独立临时环境命令见独立报告，无固定测试程序或测试入口。

## 未覆盖

生产部署、会员正文实际解锁、网络故障重试交互、跨kind完全相同UUID与时间的实际分页边界。构建和静态检查不代替上述业务证据。后端API需先于新Web部署，本次未发布线上。
