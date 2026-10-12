开发检查，非最终独立验收。

版本：b5adc5b 工作树，含后续 BFF引用白名单和img node剥离；随后新增版本预览投影尚未在此环境验证。运行pnpm typecheck、隔离配置下pnpm build均通过。PG独占55459/yoryon_posts，API4459，Next production3159，随机本地密钥、FS/tmp，无可达SMTP；仅本次2个临时作品。数据库由0000–0005迁移加现场drizzle push建成，不能替代最终迁移验收。

实际入口：node --env-file=.env.posts --import tsx packages/db/src/migrate-cli.ts（该入口随后被新应用migrator取代）；pnpm --filter @yoryon/db exec drizzle-kit push --force；node --env-file=.env.posts --import tsx apps/api/src/index.ts；pnpm build（由Node子进程继承隔离配置）；pnpm --filter @yoryon/web exec next start --port 3159；node --env-file=.env.posts --import tsx apps/cli/src/index.ts publish /tmp/yoryon-posts-input/{article,mixed}。

IAB真实点击“展开”后按文字、图片、补充文字、视频、音频、引用作品、后续长段落顺序呈现，点击收起恢复初始长度。目标引用卡片实际可跳转；长文卡片没有原地展开。截图home-collapsed.png。此轮只作开发检查，未执行权限矩阵、迁移、完整播放器、互动和平台CDN验收，均待独立子代理。

已停止本轮API/Next，删除独占PG及匿名卷、2个临时作品/临时媒体目录与随机本地配置；未触碰生产或其他已有容器。
