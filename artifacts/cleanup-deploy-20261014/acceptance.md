# 独立验收：清理与生产发布

版本：ce35856b3cb1f794439dea7e986c6f55e8462b33。日期：2026-10-14，Asia/Singapore。

前提：匿名浏览器；只读生产页面，不登录、不创建业务数据、不发送邮件。浏览器使用内置 IAB 临时标签 1；子 agent 不支持 visible:true，随后改用 visible:false。

## 发布前观察

- 首页新版作品列表可见，三条作品均出现「互动信息加载失败」，点赞 disabled。
- 点击「重试」后短暂清除错误，随后三条作品恢复同一错误：FAIL。
- 点击 Jev 作品标题，正文及五张图的可访问名称可见，评论区显示「评论加载失败」：正文 PASS，评论 FAIL。
- 点击全站搜索，输入 Jev 点击搜索，显示「接口不存在」及重试：FAIL。
- 主 agent 确认生产 API 为旧版 8ac4c1a，此观察仅为部署前基线，不能作为最终发布结果。

## 实际检查命令

```sh
git show --stat ce35856
git status --short
git worktree list --porcelain
git branch -vv
git show ce35856:apps/api/src/routes/content-interactions.ts
git show ce35856:apps/api/src/routes/article-feed.ts
git -C /Users/yoryon/.codex/worktrees/favicon-avatar/yoryon status --short
git branch --merged main
```

清理前 main 位于 ce35856；另有 codex/favicon-avatar、codex/literal-search、codex/tags-api-hotfix。它们没有直接被 Git 判定 merged main，须保留可恢复归档引用再清理。favicon-avatar 工作树 status 空白。

## 最终验收

清理 PASS：独立运行 `git worktree list --porcelain` 仅剩主工作树；`git branch -vv` 仅剩 main。运行 `git ls-remote --tags origin 'archive/20261014/*'` 确認远程归档依然指向原 tip：favicon-avatar → 4b686bd9c748c78b3c6eaa5e687081644aa613b9；literal-search → a85e220f4373a04e6fb252f2599fe1102a33ae3f；tags-api-hotfix → cee49001165ffadf5e5f755e702932fc2f3b3adb。本地同名标签存在，历史提交可恢复。

后端修正镜像上线后完成现场复验，最终匿名路径 PASS：

| 路径与操作 | 实际可观察结果 | 结论 |
| --- | --- | --- |
| 原失败搜索页点击重试，搜索 Jev | 从「接口不存在」恢复为 Jev 免费文章，带描述和三个定位原文片段；本小时剩余 9 次搜索 | PASS |
| 点击搜索结果标题 | 打开 /p/jev-typed-decisions，标题、正文、图的可访问名称正常 | PASS |
| 文章评论读取 | 从原「评论加载失败」恢复为「还没有评论。」；匿名看到「登录 后参与评论」 | PASS |
| 文章导航首页 | 三篇作品均显示「评论，0条」「点赞，0个赞」，不再显示互动错误 | PASS |
| 匿名点击首页首篇点赞 | 跳转 /login?returnTo=%2F，登录表单可见；未写入点赞 | PASS |
| 导航订阅 | 会员状态 ¥29.9/月、会员权益、兑换激活码入口、会员作品空态正常，无接口错误 | PASS |
| 探索 → 标签 → #agents 3 | 标签列表正常，进入 /tags/agents 显示三篇作品及正常互动信息 | PASS |

实际浏览器步骤：`tab.click(141)` 重试搜索；`tab.click(142)` 点击搜索结果；`tab.playwright.getByRole("link", {name:"首页", exact:true}).click()`；`tab.playwright.getByRole("button", {name:"点赞，0个赞", exact:true}).first().click()`；导航订阅，再点击探索菜单中的标签与 #agents 3。每次动作后读取最终 DOM/AX 快照；末尾标签页截图在该独立 agent 的工具回执中。可重复生成：开启匿名 IAB → https://yoryon.com → 搜索 Jev → 点击结果 → 查看评论 → 首页 → 点击点赞 → 订阅 → 探索/标签/#agents。搜索有每小时限额，复验需保留配额。

登录、会员权限、写入点赞/评论、邮件、付费购买路径本次不覆盖，标记 UNVERIFIED。生产页面无会员作品，无法从本次匿名只读生产浏览确认付费内容泄漏边界：UNVERIFIED。没有新增验收业务数据。
