# 本地预览启动回执

前提：已有隔离开发数据库 yoryon_page_redesign_20261013 与配套本地 fs 存储；依赖已安装。配置文件保留于 /tmp/yoryon-local-preview-20261015.env，权限 0600，不保存密钥于工件。当前终端服务保留运行。

从仓库根目录启动 API：
`node --env-file=/tmp/yoryon-local-preview-20261015.env --import tsx apps/api/src/index.ts`

从 apps/web 启动 Web：
`node --env-file=/tmp/yoryon-local-preview-20261015.env node_modules/next/dist/bin/next dev -p 3000`

正式迁移入口：
`node --env-file=/tmp/yoryon-local-preview-20261015.env --import tsx apps/api/src/migrate.ts`

迁移回执：searchProjections=14，SQL migrations and public preview backfill applied。

账号通过项目 hashPassword 与 Drizzle users 插入创建，执行前核对 current_database。身份为 active/user，无管理员或订阅权益。账号为用户请求的交付数据，保留供操作。没有源码修改，没有生产写入或邮件发送。
