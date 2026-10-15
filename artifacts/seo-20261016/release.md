# SEO 正式发布回执

日期：2026-10-16，Asia/Singapore。

## 版本与部署

- 实现提交：`052a9ee34cf3b801ed7da4b60c5021536ed79259`，已 push，`git ls-remote origin refs/heads/main` 核对一致。
- 项目：`zyy2740738166-7111s-projects/yoryon-web`，ID `prj_xqDwJzlRrfdQA63FIMeIsRpReaRP`；发布前及干净目录中均执行 project inspect 核对。
- 部署：`dpl_6VMUXN5jSQUa32yxvbRkPZTyno9J`，Production，Next.js，READY。
- 暂存地址：`https://yoryon-kdt0nw3b5-zyy2740738166-7111s-projects.vercel.app`。
- 正式地址：`https://yoryon.com`；promote 后 inspect 正式域名解析到同一部署 ID。
- 发布源：从实现提交的 `git archive` 生成临时干净目录，仅复制现有项目的 `.vercel/project.json`。`release-source-check.json` 核对所有变更源文件 SHA-256 与提交一致，不包含工作区原有其他改动/未跟踪文件/隔离配置。
- 仅发布 Web，无 API、数据库迁移、生产数据写入或邮件操作。

## 实际发布顺序与命令

```sh
git push origin main
git ls-remote origin refs/heads/main
# 干净目录由 git archive 052a9ee 解包，复用已核对的项目链接
vercel project inspect --non-interactive --cwd <clean-release-directory>
vercel deploy --prod --skip-domain --yes --no-wait --meta githubCommitSha=052a9ee34cf3b801ed7da4b60c5021536ed79259 --meta githubCommitRef=main --cwd <clean-release-directory>
vercel inspect dpl_6VMUXN5jSQUa32yxvbRkPZTyno9J --wait --timeout 45s --format json
vercel curl '/?utm_source=seo' --deployment dpl_6VMUXN5jSQUa32yxvbRkPZTyno9J -- --fail --silent --show-error
vercel curl '/c/first-internship-diary' --deployment dpl_6VMUXN5jSQUa32yxvbRkPZTyno9J -- --fail --silent --show-error
vercel curl '/login' --deployment dpl_6VMUXN5jSQUa32yxvbRkPZTyno9J -- --fail --silent --show-error
vercel curl '/sitemap.xml' --deployment dpl_6VMUXN5jSQUa32yxvbRkPZTyno9J -- --fail --silent --show-error
vercel curl '/p/deepseek-harness' --deployment dpl_6VMUXN5jSQUa32yxvbRkPZTyno9J -- --fail --silent --show-error
vercel curl '/p/first-internship-day-42' --deployment dpl_6VMUXN5jSQUa32yxvbRkPZTyno9J -- --fail --silent --show-error
vercel promote https://yoryon-kdt0nw3b5-zyy2740738166-7111s-projects.vercel.app --yes
vercel inspect https://yoryon.com --format json
vercel logs --deployment dpl_6VMUXN5jSQUa32yxvbRkPZTyno9J --level error --since 15m --no-branch --json
```

实际执行 curl 使用 `--output` 保存对应 staged-* 原始回执；部署状态仅保存公开事实，不保存环境配置或保护绕过凭证。

暂存检查 PASS：正式域名 canonical；真实合集 description 去掉粗体/换行标记；登录 noindex,follow；sitemap 67 个正式域名 URL、没有 lastmod；公开及付费 Article author/mainEntityOfPage/isPartOf、真实发布时间和收费标记正确。

## 正式域名验收

由独立子 agent 读取生产匿名页面/API，并逐项对比本次上线前公开基线；完整结论、范围及命令见 `acceptance/independent-acceptance.md`，回执见 `production-summary.json`、`production-visible-comparison.json` 及同目录 production-* 文件。

主代理观测：正式域名为预期部署，过去 15 分钟该部署返回的 error 日志条数为 0（runtime-error-summary.json）。这是有限窗口的日志扫描，不代表持续监控或未来无错误。

浏览器视觉/交互：UNVERIFIED。主代理在内置 Browser 尝试创建/读取 AX、DOM 及截图均 30 秒超时，CUA Chrome 不可用；子代理同样受限制。没有将 HTML 对比、HTTP 成功或构建成功写为真实浏览器验收通过。

搜索引擎重新抓取、实际收录/采用 canonical/排名及 Rich Results 展示：UNKNOWN/UNVERIFIED，不以发布成功推断。

## 回滚

上一版生产部署：`dpl_GFjj2oxssGicJSwe2Nwn7PUwKnrf`，`https://yoryon-2g12t521m-zyy2740738166-7111s-projects.vercel.app`。需要恢复时，在已确认的同一项目执行：

```sh
vercel promote https://yoryon-2g12t521m-zyy2740738166-7111s-projects.vercel.app --yes
```

本次未执行回滚。没有数据库或内容数据需要恢复。

独立正式结论：SEO HTML/API PASS；本地 SQL/源码审查 PASS；真实浏览器 UNVERIFIED。正式 sitemap 67 个唯一 URL 与真实 API 的 63 个公开内容/合集路径加 4 个固定入口一致；无 lastmod。包含 UTM/www 变体的 canonical 均为对应正式干净地址，七类功能页 noindex 正确，正常内容页未被污染。15 个相同路径的上线前后 main 文字、链接、媒体属性均一致。实习合集匿名 DTO 完全一致（37 章：15 full / 22 preview）；Day42 仍 paid + preview，匿名正文为空，JSON-LD 无会员正文。具体回执见 `acceptance/production-contract-review.json`。

## 临时资源清理

本次 Web/API 均已停止；独立子 agent 确认并删除专用克隆库 `yoryon_seo_20261016` 与 `/tmp/yoryon-seo-20261016` 配置/存储，保留原隔离源库/存储；清理回执 `acceptance/cleanup-receipt.json`。干净发布目录与空的临时错误响应也已移除，可从实现提交重新生成 archive。源码、原始匿名回执、摘要、命令和校验和保留于本目录。
