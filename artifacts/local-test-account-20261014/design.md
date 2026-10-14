# 用户请求的本地测试账号

用户明确请求可用测试账号。仅在现有隔离数据库yoryon_page_redesign_20261013中创建新普通用户，不改已有用户、不设admin、不发送验证邮件、不写生产。通过项目现有hashPassword保存Argon2id哈希；独立用户名/email碰撞则停止，不覆盖。

本地会员预览需要付费正文和提问入口，因此提供30天subscription测试权益；通过现有generateCode与redeemCode语义建立activation→redemption→entitlement，不手写不完整权益记录。

账号和权益属于用户请求的交付数据，保留供用户浏览；凭据只在0600临时文件中传给独立验收agent，不进验收工件/日志。验收只走login→subscription→paid detail→account menu→logout，不发邮件、不提问/评论/点赞，不修改资料。关闭验收tab前，最后读取精确analytics SID并清理自身统计，会话通过真实logout撤销。若IAB初始已登录其他用户，停在表单前报告，不覆盖用户登录状态。

预先边界：邮箱与username唯一、role=user/status=active、密码能经现有登录处理校验、会员有效期30天、付费作品可读、菜单显示个人资料/退出且没有登录/注册、退出返回匿名。不得以数据库成功或HTTP200单独当作可用账号。

复现：启动environment.json的本地服务，用户使用提供的凭据在http://localhost:3015/login真实登录；本次不修改源码，不需要重建或增加固定测试程序。
