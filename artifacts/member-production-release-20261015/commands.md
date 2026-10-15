# 实际发布命令与回执位置

从仓库根目录执行：

```sh
pnpm typecheck
git add -A
git commit -m 'feat: 按合集聚合会员作品并修正章节返回'
git push origin main
docker build --platform linux/amd64 -f deploy/Dockerfile.production -t yoryon-api:2679777df17d026a655faa1f63c83eebde0308d9 .
docker save yoryon-api:2679777df17d026a655faa1f63c83eebde0308d9 | gzip -1 | ssh admin@8.222.152.17 'gzip -d | sudo docker load'
ssh admin@8.222.152.17 'sudo /opt/yoryon/backup-neon.sh'
ssh admin@8.222.152.17 'sudo docker run --rm --env-file /etc/yoryon/migrate.env yoryon-api:2679777df17d026a655faa1f63c83eebde0308d9 node dist/migrate.js'
```

备份在上传和迁移之前实际完成；上方按命令类别排列，不代表时间顺序。通过owner角色的pg Client实际执行runtime-grants.sql并核对schema-after.json，随后原子更新/opt/yoryon/.env唯一YORYON_IMAGE指针，校验原值是已记录旧镜像后才替换，其他配置保留。启动命令：

```sh
ssh admin@8.222.152.17 'cd /opt/yoryon && sudo docker compose -f compose.neon.yml up -d --wait --wait-timeout 120 api'
```

Vercel从git archive的2679777源码快照执行，复用本机已链接项目metadata，不下载或打印生产环境值：

```sh
vercel --prod --skip-domain --no-wait --yes --archive tgz --scope zyy2740738166-7111s-projects --meta githubCommitSha=2679777df17d026a655faa1f63c83eebde0308d9 --meta githubCommitRef=main --meta githubCommitOrg=nanzhi84 --meta githubCommitRepo=yoryon --format json
vercel inspect dpl_CqBbP81RxdAQsFYFm2gagznfFwem --wait --timeout 180s --scope zyy2740738166-7111s-projects
vercel curl /subscription --deployment https://yoryon-pst6jj2a4-zyy2740738166-7111s-projects.vercel.app -- --silent --show-error --fail
vercel promote https://yoryon-pst6jj2a4-zyy2740738166-7111s-projects.vercel.app --yes --scope zyy2740738166-7111s-projects
vercel logs dpl_CqBbP81RxdAQsFYFm2gagznfFwem --level error --since 15m --limit 50 --json --no-branch
```

一次staged /c请求遇到网络TLS错误，重试返回正确应用空态；不把登录页200或单次HTTP成功当成业务通过。CLI已通过既有授权访问受保护部署，没有额外授权修改、Cookie/令牌落盘或私密header工件。

原生运行核对由docker run --rm --platform linux/amd64 --entrypoint node在镜像内import sharp/argon2，真实生成WebP并hash/verify；私有数据库查询只用既有受保护env，不输出连接串。独立现场SQL/API/CLI/浏览器路径与未覆盖项见独立报告。
