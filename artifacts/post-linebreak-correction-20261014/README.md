# 8条帖子换行纠正

用户澄清：去掉空一行，保留逐行换行。本次从artifacts/dated-posts-20261014原始帖子稿取非空行，删除行间空白段，以Markdown硬换行（行末两空格）连接，保留每行措辞/标点及顺序。每篇单一段落，行间br；manifest.json保留逐行预期与硬换行数量。frontmatter/日期/slug/公开设置不变，其他帖子不更新，日期右侧UI不变。没有代码修改，未运行typecheck/build。

实际命令：
```sh
scp -r artifacts/post-linebreak-correction-20261014/posts admin@8.222.152.17:/opt/yoryon/posts/post-linebreak-correction-20261014
ssh admin@8.222.152.17 'cd /opt/yoryon && sudo docker compose -f compose.neon.yml run --rm cli publish /posts/post-linebreak-correction-20261014'
```

生产yoryon.com与现有ECS CLI/Neon，需已有SSH/sudo及可用配置。只更新用户授权8条，不发邮件。不创建测试业务数据/程序。publish.log为发布/缓存回执，独立验收见acceptance.md，必须检查实际DOM p/br与逐行文字，不仅去空白全文比对。浏览器此前不可用，不声称像素视觉验收。
