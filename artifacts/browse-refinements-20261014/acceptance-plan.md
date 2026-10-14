# 独立浏览验收范围

仅验收 Web3015/API4115/DB `yoryon_page_redesign_20261013`，绝不使用生产数据或向真实用户发信。每次数据库写操作先核对 `current_database()`。本轮普通临时用户和26篇文章见 `acceptance-premise.json`；随机密码只在0600私密临时文件。

现场选择真实路径：

- 首页首次点击音频后检查实际audio currentTime/paused与固定控件，暂停、seek、再次播放、离开视口及媒体互斥；必要时只在专用标签阻断媒体请求，检查中文错误与重试。
- 图集图片真实打开，检查只居中图像、无卡片背景边框及文字按钮，ESC/点击外侧关闭和焦点返回。
- 首页先加载超过20条，再从追加页打开文章、点返回，核对原条数和窗口scrollY；标签页和兑换页各走返回与直接访问fallback。
- 描述为空的公开文章出现正文纯文本摘要；付费marker文章的公开摘要不能包含付费后半段。
- 订阅仅两个主tab“会员作品”“会员问答”，点击/键盘操作及可见内容；原会员权限保持。
- 探索菜单仅合集/标签，标签入口只显示标签；没有关于我/全部探索。
- 从顶栏搜索进入独立页面，搜本轮25条文字，加载第二页，点结果后返回，核对query/全部结果/分页/scrollY；数据库新增搜索会话数量证明返回复用原会话而非新扣额。另测空态、失败、会话失效、付费元数据无snippet/定位、身份变化清空。
- 文章正文/合集/评论没有硬分割线。
- 单一双态外观开关、持久化light/dark与无system选项。
- 匿名菜单仅登录/注册账户入口，登录成功后只有资料/退出；真实UI退出后恢复匿名，数据库会话删除。

## 已执行准备命令

1. 从 `apps/cli` 运行 `node --env-file=/tmp/yoryon-page-redesign-m0NxxV/preview.env --input-type=module` 的一次性stdin代码，使用pg连接并检查DB名称，读取原始7篇/0用户/1个非本轮search_session；用已有argon2哈希随机密码创建普通active临时用户，凭据写0600私密文件。
2. 在 `/tmp/yoryon-page-redesign-m0NxxV/browse-acceptance-content` 写25篇公开阅读记录（空description）和1篇带marker付费阅读记录（公开首段和付费后段）。日期在原演示内容之后，避免改变顶端展示。
3. 真实发布：`pnpm exec tsx --env-file=/tmp/yoryon-page-redesign-m0NxxV/preview.env apps/cli/src/index.ts publish /tmp/yoryon-page-redesign-m0NxxV/browse-acceptance-content > artifacts/browse-refinements-20261014/acceptance-publish.log 2>&1`。退出0，26次database committed；cache pending因CLI配置未含web invalidation配置，已告知主agent，后续新构建/页门禁必须使用当前catalog版本。

本文件仅记录现场命令和选择依据，不是固定可执行测试程序。最终将按自有实体ID/slug精确删除本轮数据和本轮搜索会话，保留原始演示与非本轮会话。
