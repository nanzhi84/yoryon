# Vercel 检查：既有环境阻断

状态：FAIL（远程构建），不能声称 CI 或生产部署通过。

GitHub 对两个精确 SHA 都返回 Vercel failure；无 GitHub Actions workflow run。

| 范围 | SHA | Deployment | 实际原因 |
| --- | --- | --- | --- |
| PR #25 实现 | d8f5afc483cec81f29c02c1bebfec654090f6a49 | dpl_9DN5vVcG88vqTvF3aMphcNSFcvQZ | `/explore` prerender: `Error: tags API 404` |
| 变更前 origin/main | 4ab867a7fd34f7f58c79aba7887fcd5fa5366a17 | dpl_BnUNFMbTaGfRrPzQeNVvh8e9wGre | 同一路径、同一错误；2026-10-13T03:40:58.726Z 已发生 |

读取命令：

```sh
vercel --scope zyy2740738166-7111s-projects inspect dpl_9DN5vVcG88vqTvF3aMphcNSFcvQZ --logs
vercel --scope zyy2740738166-7111s-projects inspect dpl_BnUNFMbTaGfRrPzQeNVvh8e9wGre --logs
```

两个命令均实际取得日志，退出1（Error部署）。PR 日志确认 Commit d8f5afc，编译及类型校验通过后，在现有探索页取 tags 的静态生成阶段失败。main 日志确认 Commit 4ab867a，同样在编译/类型校验之后以 `tags API 404` 失败。原有成功缓存来自更早的 ab6e744，不是当前 main 成功证据。

MCP 访问该团队返回403；使用 CLI 自有授权与明确团队取得日志。GitHub检查URL的部署后缀需补 dpl_ 前缀，未经补齐的第一次 inspect not_found 不代表部署不存在。

结论：远程预览失败已经存在于本次分支之前；本次完整构建仅在有可用隔离API的本地环境验收通过。此项不能计为PASS，也不扩张到修改生产API或业务数据。上线仍须协调API版本、迁移/投影回填、Web构建及生产用户路径验收。
