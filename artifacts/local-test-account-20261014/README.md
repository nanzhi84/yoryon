# 用户交付的本地测试账号

当前本地预览http://localhost:3015/login。账号/30天subscription属于用户明确请求的交付数据，保留供用户操作；普通user权限，不设admin，没有发送邮件或生产写入。到期时间见provision.json。最终凭据只在对用户交付消息中提供；私有0600临时凭据文件已删除，密码/哈希/激活码/会话令牌不保存于工件。

独立真实浏览验收PASS：登录、会员状态、付费正文、账户菜单、退出；账号最终sessions=0。精确清8条自己SID统计，其他167条不变；完整范围/失败与回执见acceptance.md、commands.md、cleanup.json。此次没有源码修改，不运行不相关构建或创建固定测试程序。

创建操作：apps/cli目录node --env-file=/tmp/yoryon-page-redesign-m0NxxV/preview.env --import tsx --input-type=module stdin；PG current_database防护→身份唯一性检查→项目hashPassword→参数化普通用户active INSERT→项目generateCode单次30天subscription→项目redeemCode建立兑换与权益。没有调用注册发信路径，没有直接提升管理员或拼造权益记录。
