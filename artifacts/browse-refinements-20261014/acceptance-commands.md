# 现场执行与复现记录

这些是本次真实操作回执和数据前提，不是固定测试套件或可执行断言程序。工件、命令和数据来源均限定于隔离本地环境。

## 环境与数据准备

- 工作区 `/Users/yoryon/Projects/yoryon`；Web3015/API4115；DB必须严格等于 `yoryon_page_redesign_20261013`。
- 在 `apps/cli` 目录运行 `node --env-file=/tmp/yoryon-page-redesign-m0NxxV/preview.env --input-type=module` 的一次性stdin JavaScript，导入pg/argon2/fs/crypto。连接后首先执行 `select current_database()`，不匹配即停止；记录原始7篇/0用户/1个搜索会话。
- 用已有argon2对随机密码哈希后插入自有 `status='active',role='user'` 用户，用户名 `browse_refinements_20261014`；凭据仅存0600私密临时JSON。用户ID、slug、环境见 `acceptance-premise.json`。
- 25篇真实临时公开阅读记录的标题为“浏览连续体验 · 阅读记录 01…25”，type=article、visibility=public、description缺省空、tag=`browse-refinements`，日期为2026-10-10，均放原演示之后。正文两段：第一段记录序号与“阅读中的思考需要在返回列表后继续，页面应记住已经加载的内容与停留位置。”；第二段“浏览连续体验的练习：读完一段文字，点开一篇文章，再回到同一个位置，继续阅读下一篇。”。另1篇 `browse-20261014-paid` 为paid/marker，公开首段“这是公开阅读预览，只允许公开部分生成摘要。”，more标记后为本轮自有付费检验文本。
- 按项目实际发布目录约定写 `index.md`（frontmatter含title/slug/type/visibility/tags/published_at/preview），实际执行：

```sh
pnpm exec tsx --env-file=/tmp/yoryon-page-redesign-m0NxxV/preview.env apps/cli/src/index.ts publish /tmp/yoryon-page-redesign-m0NxxV/browse-acceptance-content
```

完整stdout在 `acceptance-publish.log`，26次database committed。CLI缺少cache投递配置而pending已明确记录；后续独立构建和catalog门禁使用实际推进后的版本。无需回退catalog/search epoch。

## 实际Browser操作

独立agent通过 `cua.createBrowserTab('iab','http://localhost:3015/',{visible:false})` 建专用标签。源码/构建更新后用 `tab.reload()`；每次操作后读取最新AX/DOM/截图。没有使用用户标签或安装其他浏览器。

1. 首页只点击一次“播放音频”，读取actual audio paused/currentTime/duration/readyState及控件rect；通过CDP DOM.getDocument/DOM.querySelector记录节点ID前后相同。再点击暂停、对“音频进度”用Home/ArrowRight、播放后立刻点击视频，核对媒体互斥与图标。发现失败后在修订构建完全相同路径复验。
2. 对本标签通过CDP Network.setBlockedURLs临时阻断 `http://localhost:3015/api/media/*`，临时禁用网络缓存，真实点击播放，读取Network.loadingFailed两次回执及中文错误；恢复阻断空列表/缓存原状态后点击“重试播放音频”，实际进度开始。
3. 真实打开图集，读取dialog computed styles/文字/按钮及图片rect；Esc后读焦点；再次打开后点击坐标[10,10]外侧，检查关闭与焦点。
4. 首页点击“加载更多”，选择追加页“11”进详情后用“返回上一页”；读取sessionStorage公开浏览位置元数据和实际scrollY/内容条数。原生鼠标滚动/locator自动对齐产生移动时，以实际click捕获的保存点比较；最终5763.5→5763.5。标签同法20→26条、“06”返回5290→5290。
5. 地址直接访问 `/p/demo-ep1`，观察正文/合集/评论及0px边界，返回fallback到首页。探索菜单真实展开，仅合集/标签；标签菜单进入 `/tags`，只有标签主体；#demo进入并返回标签列表。
6. 订阅作品/问答tab分别点击，读取aria-selected/hidden/tabIndex；在问答tab按ArrowLeft，观察作品tab选中且焦点移动。由兑换激活码链接进兑换后真实点返回。
7. 顶栏全站搜索进入 `/search`，真实填写“浏览连续体验”并搜索，加载更多20→25条，进入“05”再返回；读取query/条数/分页元数据/scrollY/额度文字。最终Web85716路径3305→3305、session不变、offsets[0,20]及quota5保持。通过Network.requestWillBeSent只取本标签/api/search的query/requestId/session/cursor，不保存认证Header或Cookie。
8. 临时只阻断本标签 `/api/search`，输入无命中原文，观察中文失败/结果0；恢复并点击重试，观察空态。检验付费后半段正文搜索，仅元信息无定位；通过SQL只让本标签自有搜索session过期，真实进入结果文章再返回，观察失效/清结果及重试恢复。
9. 匿名账户菜单展开，观察仅登录/注册和双态外观开关；实际点击开关两次，读取class/aria-checked/storage，恢复最初dark。通过菜单登录，填写私密临时凭据，正常提交；观察仅资料/退出。Back经过登录页回旧搜索，query空/结果0。
10. 自有临时用户用项目真实CLI授予订阅：

```sh
pnpm exec tsx --env-file=/tmp/yoryon-page-redesign-m0NxxV/preview.env apps/cli/src/index.ts entitlement grant --user browse_refinements_20261014 --scope subscription --days 30 --reason 'browse-refinements isolated acceptance'
```

会员页真实显示已开通/剩余提问1次/问答输入；会员搜索真实显示无限搜索和付费命中。随后在已核对数据库的连接中，仅对自有user_id执行 `update entitlements set valid_from=clock_timestamp()-interval '2 days',valid_until=clock_timestamp()-interval '1 day' where user_id=$1`，浏览器返回搜索实际重授权，付费定位1→0。

11. 只对本标签阻断 `/api/auth/logout`，真实点击退出，观察失败且仍资料/退出；恢复阻断后重试退出，正常匿名；Back到旧搜索仍空。SQL检查该user_id的sessions已0。另只阻断auth/me，reload后观察账户状态重试；恢复后点击重试恢复匿名。
12. pagehide边界通过CDP Runtime.evaluate在专用标签临时注册一次性观察，仅写 `{persisted,searchInputs,bodyHits}` 到自有验收键；地址导航离开搜索后读取该元数据。最终离开前25个bodyHits，pagehide时0；persisted=false。Back实际重新加载25条。观察键已删除，专用标签关闭；没有修改产品源码或保留观测程序。

## SQL核对与清理

使用上述node stdin/pg方式，每次写操作先检查current_database。只查询/保存必要ID、计数、日期、metered、jsonb_array_length(results)，不保存连接串、哈希身份或query_cipher。

- 记录搜索新建/分页/返回后 `search_sessions` 的id/request_id/metered/epoch/results长度；第一次公开搜索仅新增一个会话，分页/返回没新增，UI额度相同。会话精确ID与请求见 `acceptance-search-sql.json` 和各请求/存储回执。
- 最后通过Node child_process.spawnSync逐个执行实际CLI `pnpm exec tsx --env-file=… apps/cli/src/index.ts content delete <本轮slug>`，26次退出0；完整命令与stdout见 `acceptance-content-cleanup.log`。
- 最后CDP环形缓冲已淘汰旧事件，清理精确ID集合由早期完整请求回执、末次请求回执和已保存的各搜索session/requestId组合，未按全局网络或身份桶删除。
- 在事务中按自有request_id/session_id删除5个搜索会话；按自有analytics session_id删除38条统计；按自有user_id/code_id删除权益/兑换/激活码/用户及自有通知/赞/会话（这些实际为0）；按cache event payload中的自有contentSlug删除52个事件；只删除已无content_tags引用的 `browse-refinements` 标签。
- 提交后查询自有内容/用户/会话/权益/搜索/统计/标签残留均0；原始7篇ID/slug/status完全一致；原始非本轮搜索会话仍存在；最终tag只有demo/test。receipt为 `acceptance-cleanup.json`。
- 将工件字节与本轮随机密码/隔离环境秘密值做精确匹配扫描，无命中；移除自有私密JSON与内容来源目录。没有删除整个隔离环境、其他标签、存储媒体或运行进程。

重新生成验收时应重新创建随机用户和临时内容，重新现场选定浏览路径/边界，使用当前构建/环境；本回执中的ID属于已清理历史证据，不是下次执行的固定fixture或断言数量。
