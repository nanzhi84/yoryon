# Notion 空行与经济学文章格式同步

范围：用户指定优绩主义文章与三个经济学十大原理；正文以本轮Notion fetch为准。保留原frontmatter（日期/slug/public/full/封面）和原封面字节。只更新四篇内容，不改变前端代码或全站样式，不发邮件。

原缺陷：旧内容转换删除<empty-block/>并过滤空行，因此普通段落虽保留，Notion作者额外留的空行消失。Notion增强Markdown规范明确<empty-block/>表示一个空行；源普通文本行是独立块，<br>才表示块内换行。

转换：普通文本块转独立Markdown段落，相邻列表保持列表；标题等级原样；每个empty-block单独写作&#160;空白段落（非可见文字）。实际用项目parseMarkdown→stringifyMarkdown→parseMarkdown检查空段经过发布转换仍保留为paragraph；不靠Markdown多空行（会被折叠），不引入新协议或原始HTML执行。源<br>转Markdown硬换行。优绩主义5个空段，三篇经济学各1个空段；经济学h2分别4/3/3。manifest记录源与稿哈希，原始源见*-notion.json。

生产环境：yoryon.com，ECS /opt/yoryon，现有生产CLI/Neon/OSS配置。需可用SSH、sudo、配置及连接，不输出凭据。实际命令：
```sh
scp -r artifacts/notion-spacing-refresh-20261014/posts admin@8.222.152.17:/opt/yoryon/posts/notion-spacing-refresh-20261014
ssh admin@8.222.152.17 'cd /opt/yoryon && sudo docker compose -f compose.neon.yml run --rm cli publish /posts/notion-spacing-refresh-20261014'
```

无代码修改，未跑typecheck/build。publish.log记录发布与缓存回执；独立验收需核对空段的数量和相邻段落位置、标题、列表及实际完整正文，不能仅去除所有空白后声称空行保真。acceptance.md记录独立结果和未覆盖范围。没有新增测试程序或测试业务数据。
