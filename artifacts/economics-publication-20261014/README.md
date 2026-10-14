# 六篇 Notion 文章发布

环境：生产 yoryon.com，ECS `/opt/yoryon`，生产 CLI、Neon 与私有 OSS。仅发布用户指定六篇，不修改程序、其他内容、用户或发送邮件。

正文来自本轮 Notion fetch，原始回执为 `*-notion.json`。写作日期以 Notion 的“写作日期”字段为准；本地 PaperNotes 日期有差异，不采用。日期按 Asia/Singapore 当天零点保存。公开免费全文，封面通过 cover 字段引用，对应本地原图及 SHA256 见 manifest.json；未取得 Notion 当前附件字节，图片与 Notion 逐字节一致为 UNVERIFIED。源稿、媒体保留在 posts/，可按相同 slug 幂等重发。

实际命令：
```sh
scp -r artifacts/economics-publication-20261014/posts/economics-principles-decision artifacts/economics-publication-20261014/posts/economics-principles-interaction artifacts/economics-publication-20261014/posts/economics-principles-overall artifacts/economics-publication-20261014/posts/buffett-casino-church admin@8.222.152.17:/opt/yoryon/posts/
ssh admin@8.222.152.17 'cd /opt/yoryon && sudo docker compose -f compose.neon.yml run --rm cli publish /posts/economics-principles-decision && sudo docker compose -f compose.neon.yml run --rm cli publish /posts/economics-principles-interaction && sudo docker compose -f compose.neon.yml run --rm cli publish /posts/economics-principles-overall && sudo docker compose -f compose.neon.yml run --rm cli publish /posts/buffett-casino-church'
```

前提：SSH 与 sudo 已配置，生产 compose/cli.env、DB 与 OSS 可用；不输出配置和凭据。回执 publish.log。四篇均 database committed、cache verified。业务验收另见独立 agent 的 acceptance.md；发布回执不替代浏览器业务验收。没有代码变更，因此未运行 typecheck/build。未创建额外测试数据。

追加《先自由后财富》：实时 Notion 写作日期 2026-10-09，无源媒体；七个编号观点转换为 Markdown 三级标题，空块转换为段落间距，保留正文措辞。命令：
```sh
scp -r artifacts/economics-publication-20261014/posts/freedom-before-wealth admin@8.222.152.17:/opt/yoryon/posts/
ssh admin@8.222.152.17 'cd /opt/yoryon && sudo docker compose -f compose.neon.yml run --rm cli publish /posts/freedom-before-wealth'
```
回执 publish-freedom.log。主 agent 内置 Browser 创建与读取均超时，无法完成视觉验收；getState 只确认首页标签存在，不能证明可见结果。静态源码提示搜索日期目前直接截取 UTC 日期，有可能显示前一天；本轮未执行搜索产生会话，此项 UNVERIFIED，首页及详情日期由 Asia/Singapore 格式化，独立验收核对实际 HTML。

追加《被优绩主义腌入味后，连痛苦都被剥夺了正当性》：实时 Notion 写作日期 2026-04-02，无媒体。保留原文，仅将 Notion 空块转换为 Markdown 段落间距。
```sh
scp -r artifacts/economics-publication-20261014/posts/meritocracy-and-pain admin@8.222.152.17:/opt/yoryon/posts/
ssh admin@8.222.152.17 'cd /opt/yoryon && sudo docker compose -f compose.neon.yml run --rm cli publish /posts/meritocracy-and-pain'
```
回执 publish-meritocracy.log。
