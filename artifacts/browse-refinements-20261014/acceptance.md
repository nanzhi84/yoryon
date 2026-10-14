# 独立浏览验收

用户15条标注要求的可见页面与交互均为 **PASS**。实际发现的音频快速切换竞态已修复并复验；搜索所有离开入口的正文DOM清理已补齐并复验。当前Browser没有触发 `pagehide.persisted=true`，真实BFCache冻结分支为 **UNVERIFIED**，没有以构建或HTTP成功替代该结论。

## 环境与版本

- 本地 Web `http://localhost:3015`、API `http://127.0.0.1:4115`、隔离数据库 `yoryon_page_redesign_20261013`，存储 `/tmp/yoryon-page-redesign-m0NxxV/storage`；无生产修改，无邮件发送。
- 最终Web PID85716/API62175；独立副本 `/var/folders/d_/8w6ff22d7gn6r0vr84g21d5r0000gn/T/yoryon-browse-refinements-verified-r43f04vx/workspace`。源码与副本55个文件摘要见主agent的 `source-manifest-final.json`，类型检查/构建日志仅证明静态检查通过。
- 独立内置Browser专用隐藏标签，使用默认1280×720视口；未操作用户标签。账户Cookie同源共享，登录与退出阶段均提前通知主agent，结束已匿名并关闭专用标签。
- 原始数据为7篇演示、0用户、1个非本轮搜索会话。临时普通用户、25篇公开阅读记录和1篇marker付费文章通过真实CLI/数据库流程准备。分页及摘要均检查真实已发布内容，没有新增固定可执行测试程序。

## 用户标注逐项结果

| 标注 | 结果与实际证据 |
| --- | --- |
| 1 音频点击直接播放、样式稳定 | **PASS**：一次点击后实际 `paused=false`、`currentTime=0.158838`、duration3s/readyState4；播放前后audio DOM nodeId均104、控件720×64不变。最终版再次一次点击t=0.157544。见 `acceptance-audio-first.json/png`。 |
| 2、3 图片仅居中显示 | **PASS**：dialog透明、边框0、padding0、文字为空、按钮0；640×360图片在1265×720内容视口居中。Esc和点击外侧均关闭，焦点回原图。见 `acceptance-image-preview.json/png`、`acceptance-image-closed.json`、`acceptance-image-outside.json`。 |
| 4 文章返回与信息流进度 | **PASS**：首页加载追加页共31篇，打开第二页“11”后返回，31篇及scrollY5763.5精确恢复；直接访问详情的返回fallback为首页/顶部。见 `acceptance-feed-return-repeat.json`、`acceptance-direct-detail-fallback.json`。 |
| 5 长文摘要 | **PASS**：原始空description长文显示正文摘要；临时付费marker文章只显示公开首段，付费检验词未出现在公开摘要。见 `acceptance-tag-summary-before.json`、`acceptance-subscription-works.png`；空description事实见数据库基线。 |
| 6 兑换左上返回 | **PASS**：由订阅进入兑换，再通过返回按钮回订阅。见 `acceptance-redeem-return.json`。 |
| 7 会员作品/问答双tab | **PASS**：仅两主tab；点击问答后作品隐藏，ArrowLeft切回作品并移动焦点。实际有效会员仍能看到提问输入及本月剩余次数。见 `acceptance-subscription-tabs.json`、`acceptance-membership-active.json/png`。 |
| 8 删除关于我 | **PASS**：真实探索菜单中没有关于我。见 `acceptance-explore-menu.txt/png`。 |
| 9 标签入口仅标签 | **PASS**：进入 `/tags`，主体标题仅“标签”，无探索或合集区。见 `acceptance-tags-index.json/png`。 |
| 10 标签左上返回 | **PASS**：#demo返回标签列表；自有标签加载26篇后打开第二页“06”，返回26篇及保存scrollY5290。见 `acceptance-tag-return.json`、`acceptance-tag-return-settled.json`。 |
| 11 删除全部探索 | **PASS**：真实菜单仅“合集”“标签”。见 `acceptance-explore-menu.txt/png`。 |
| 12 独立搜索页与返回缓存 | **PASS**：顶栏进入 `/search`，无dialog；20→25条后打开第二页“05”，最终构建返回query、25条、offsets[0,20]、scrollY3305、剩余次数5均保持；实际会话ID未变化。见 `acceptance-search-return-verified.json/png`、`acceptance-search-sql.json`。 |
| 13 正文/合集/评论弱分隔 | **PASS**：正文可见，合集上下篇nav/section与评论section上下边框均0px。见 `acceptance-article-separators.json/png`。 |
| 14 双态外观开关 | **PASS**：仅一个深色外观menuitemcheckbox，无跟随系统；实际true/dark→false/light→true/dark，class、aria-checked、localStorage一致，并恢复进入验收时的dark。见 `acceptance-theme-toggle.json`。 |
| 15 账户入口按身份显示 | **PASS**：匿名只有登录/注册及外观；真实登录后只有个人资料/退出及外观；退出后恢复匿名，SQL自有sessions为0。见 `acceptance-account-guest.json/png`、`acceptance-account-signed-in.json/png`、`acceptance-account-logged-out.json`、清理回执。 |

## 失败方式与边界

- **音频竞态已修复，最终PASS**：首版执行“播放→暂停→键盘seek→播放→立即切视频”，真实audio已停但按钮卡在暂停，再点无恢复；保留 `acceptance-audio-stale-pause.*`。修改后完全相同路径实际paused=true且按钮为播放，见 `acceptance-audio-race-final.json/png`。播放后离开视口（audioTop=-739.5）暂停且同步控件，见 `acceptance-audio-offscreen-final.json`。
- **媒体网络失败/恢复PASS**：仅专用标签阻断媒体端点，观察失败与一次有界自动重试，最终中文错误及手动播放重试；解除阻断后actual.paused=false/t=0.16214/readyState4。见 `acceptance-audio-network-failure.*`、`acceptance-audio-network-retry.json`。
- **搜索失败/空态/会话失效PASS**：仅专用标签阻断 `/api/search`，旧结果清空且反馈中文网络错误，解除后重试为空态；对自有搜索会话设置过期，返回实际显示失效并清结果，重试正常重新搜索。见对应 `acceptance-search-network-failure.*`、`acceptance-search-empty.json`、`acceptance-search-expired*.json/png`。
- **付费搜索授权边界PASS**：无权益正文命中仅文章元数据，无snippet或定位；有效会员读到命中/无限搜索；权益到期后浏览器返回，同一session重新授权，命中位置1→0，仅元信息。没有沿用旧记忆中的付费文章完全不匹配规则。见 `acceptance-search-paid-metadata.*`、`acceptance-search-member.json`、`acceptance-search-entitlement-expired-return.*`。
- **身份变化清理PASS**：从搜索顶栏账户→登录链接离开，真实登录后Back两次到旧搜索，query空/结果0；搜索页真实退出后Back旧搜索亦为空。见 `acceptance-search-after-login-back.json`、`acceptance-search-after-logout-back.json`。
- **离开DOM清理PASS、BFCache真冻结UNVERIFIED**：首版非结果导航pagehide时bodyHits=1（persisted=false）；最终版离开前25条命中，pagehide观察为bodyHits=0，返回经服务器恢复25条。同浏览器没有触发persisted=true，未声称真冻结分支已覆盖。见 `acceptance-search-pagehide-final.json`、`acceptance-search-pagehide-restored-final.json`。
- **账户读写失败PASS**：阻断auth/me后菜单只显示状态未加载与重试；恢复后正常匿名。阻断logout时反馈退出失败并仍显示资料/退出；解除后真实登出。见 `acceptance-account-read-failure.*`、`acceptance-account-read-retry.json`、`acceptance-logout-failure.*`。

所有临时网络阻断恢复空列表；主题恢复原态。pagehide观测只临时在专用标签写元数据，不写正文，观测键已删除，专用标签关闭。

## 清理与未覆盖范围

**清理PASS**：26篇临时文章经CLI删除；精确删除自有5个搜索会话、38条匿名统计、1权益/兑换/激活码/用户、52个自有cache event及空标签；自有残留0。原始7篇ID/slug/published均保持，原非本轮搜索会话保留，最终标签只有demo/test。私密凭据与自身内容来源目录已移除，工件秘密扫描无命中。见 `acceptance-cleanup.json`、`acceptance-content-cleanup.log`。

**UNVERIFIED**：其他浏览器/设备、persisted=true BFCache、浏览器拒绝播放的权限弹窗、真实会员邮件或生产发布。本轮未新建问答/评论，也未重新覆盖已在前轮验收过的全部点赞后端边界。本轮可见设计及所改浏览路径已完成独立验收。
