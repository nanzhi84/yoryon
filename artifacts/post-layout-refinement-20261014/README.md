# 帖子日期右对齐与8条正文合段

用户明确要求：帖子不显示标题，时间保持右侧；指定8条取消人工换行。仅调整feed-timeline post头部badge/日期顺序及日期ml-auto shrink-0，不改文章标题、正文全局排版、日期值、详情页或交互。采用既有组件，无新依赖/请求/hooks。8条发布稿将原正文非空行原字符直接拼接为单段（不加标点），保留frontmatter；其他帖子不变，长句仍按屏幕自然折行。manifest记录8个slug及实际正文。两条04.24独立记录不合并。

实际生产内容命令：
```sh
scp -r artifacts/post-layout-refinement-20261014/posts admin@8.222.152.17:/opt/yoryon/posts/post-layout-refinement-20261014
ssh admin@8.222.152.17 'cd /opt/yoryon && sudo docker compose -f compose.neon.yml run --rm cli publish /posts/post-layout-refinement-20261014'
```

环境：生产yoryon.com、ECS现有CLI/Neon；需SSH sudo与已配置连接。仅用户授权8条正文写入，不发邮件。typecheck.log为pnpm typecheck；独立隔离pnpm build及现场验收见acceptance.md。前端通过git main集成部署，previous-deployment.json留回滚点。未新建固定测试或合成数据。

最终源码f145cad4ee6eae674acbaabfd10ba47554abe1a2，已push origin/main（push.log）。由Git集成触发production deployment yoryon-9q86buafh，部署状态与最终域名指向见deployment.json、production-deployment.json。源变更前已完成pnpm typecheck与独立隔离pnpm build、HTTP路径验收，无新增固定测试。

最终生产部署dpl_DnAv2tga7UFvVWmHEuEMN5xx1XhJ为READY，vercel inspect yoryon.com确认域名指向该部署。未手动创建第二个部署或promote，使用Git main集成。8条内容缓存事件全部verified；独立线上核对确认各1个p、0个br且逐字匹配，其余8条正文p/br序列与此前工件相同。
