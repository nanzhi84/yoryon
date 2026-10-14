# 16条带日期帖子发布

用户直接提供16条原文并授权公开发布。source.txt 保留原文措辞、段落与日期，仅去除粘贴带来的反斜杠转义；未取Notion内容。posts/ 是可重复发布的内容包，type: post，标题为空，public/full，不加标签与封面。Markdown行末两个空格保留原始单换行，列表使用标准Markdown。两条2026-04-24采用不同slug，不虚构日内时间或优先级，同日相对排序由现有ID排序规则决定。

日期保存为所标日期的UTC00:00，无真实日内时刻依据，仅作日期承载，现有新加坡时区页面与UTC日期截取均为原日期。只发布指定内容，不改代码、不发邮件、不修改既有文章和用户数据。

环境：生产yoryon.com，ECS /opt/yoryon，现有生产CLI/Neon/私有OSS配置。需预先具有SSH、sudo及可用配置；不输出凭据。

实际命令：
```sh
scp -r artifacts/dated-posts-20261014/posts admin@8.222.152.17:/opt/yoryon/posts/dated-posts-20261014
ssh admin@8.222.152.17 'cd /opt/yoryon && sudo docker compose -f compose.neon.yml run --rm cli publish /posts/dated-posts-20261014'
```

publish.log保留生产发布和缓存回执。manifest.json记录日期、slug与正文哈希，version.txt记录本地源码版本。原文与内容包为本次实际发布内容，不是合成fixture。无程序变更，未运行build/typecheck。独立验收见acceptance.md，命令成功不替代可见正文与日期核对。
