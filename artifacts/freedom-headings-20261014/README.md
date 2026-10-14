# 先自由后财富标题同步

用户将Notion七个观点开头改为原生二级标题。本次重新fetch页面 3f4ada53-bd2a-803e-9a5f-dac6282b4c14，以最新正文为事实源。保留原文措辞和加粗，空块转Markdown段落间距；七节采用源##标题，无自加编号。frontmatter沿用先前发布源，日期2026-10-09，article/public/full及slug不变。未改全站样式与程序，无依赖变更。

环境：生产yoryon.com、ECS /opt/yoryon、现有CLI及Neon配置；需要可用SSH与sudo权限。只更新此篇，不发邮件或写其他业务内容。notion-source.json保留最新源回执，manifest.json记录标题与哈希，posts/内容包可按slug幂等重发。

实际命令：
```sh
scp -r artifacts/freedom-headings-20261014/posts/freedom-before-wealth admin@8.222.152.17:/opt/yoryon/posts/
ssh admin@8.222.152.17 'cd /opt/yoryon && sudo docker compose -f compose.neon.yml run --rm cli publish /posts/freedom-before-wealth'
```

publish.log记录提交及缓存回执。独立验收见acceptance.md。没有代码修改，未运行typecheck/build。无需创建或清理测试业务数据。
