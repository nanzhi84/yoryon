# 个人资料页独立验收

执行者：独立子 agent `/root/profile_page_implementation_acceptance`，直接使用自己的内置 Browser 隐藏 tab（本子 agent session 的 tab 1）完成实际 UI；没有借用主 agent 的截图代替功能验证。环境：`127.0.0.1:3015` Web PID61659、API PID62175、隔离数据库 `yoryon_page_redesign_20261013`，本机文件存储 `/tmp/yoryon-page-redesign-m0NxxV/storage`。版本：`b8e7098e941f80d899cd6483a9ce236732e5ddf6` 加本次未提交视图改动，未改 API/认证配置。真实行为以595×896检查，最终截图以用户当前568×896保存。

## 结果

本次个人资料设计及所选真实功能路径：**PASS**。验收数据清理：用户、会话与自己新建头像 **PASS**；匿名统计清理 **UNVERIFIED**（原因见下）。不把构建或HTTP成功单独当业务证明。

| 现场用户路径 / 可见行为 | 结果 | 证据 |
| --- | --- | --- |
| 临时普通 active 用户通过真实登录表单进入个人资料 | PASS | provision.json；不发邮件，不使用用户保留 preview_test |
| 标题下只读用户名、头像在名称前、单栏同底色、仅一条淡细线 | PASS | preview-profile-568.png，layout-final-568.json |
| 头像64×64；标题24px；名称输入44px/15px；保存按钮160×44；主体顶部20px；无横向溢出 | PASS | layout-persistence.json、layout-final-568.json |
| 保存 `🙂资料验收` 后刷新，名称持续显示，默认头像完整显示🙂首码点，登录用户名不变 | PASS | acceptance-name-saved-595.png、layout-persistence.json |
| 名称草稿未保存，选取 package.json，页面出现“请选择 PNG、JPEG 或 WebP 图片。”；上传/保存控件仍可用 | PASS | invalid-file.json |
| 选取仓库 author-avatar.jpg（2303380字节），出现“头像最大为2MB”；名称草稿保持 | PASS | 现场 AX/工具回执；原文件超过限制，不能当成功JPEG上传用例 |
| 选取已有公开内容的640×360 PNG（2607字节），上传中控件禁用，成功后自动保存，名称草稿保持 | PASS | avatar-upload-ui.json、profile-http-receipts.json |
| 图片实际 BFF 响应可解码320×320 WebP，1744字节，SHA256与存储字节一致；SQL仍保留上次已保存名称 | PASS | avatar-bytes.json、avatar-response.webp |
| 同文件再次更换头像可执行、复用相同资产；移除后默认占位返回，未保存名称草稿仍保持 | PASS | avatar-reselect-remove.json |
| 41个中文码点名称由API400拒绝；页面可见说明；改正后保存成功 | PASS | invalid-name.json、acceptance-name-error-595.png、profile-http-receipts.json |
| 仅自己 tab 临时阻断profile请求：保存失败显示“保存失败，请重试。”；解除后同一草稿可保存 | PASS | network-mutation-recovery.json |
| 仅自己 tab 临时阻断初始GET：显示加载失败与重试按钮；解除后重试恢复表单 | PASS | load-error-keyboard.json |
| Tab从上传按钮到名称输入，再到保存按钮；隐藏原生文件输入不进入键盘顺序 | PASS | load-error-keyboard.json |
| 最后实际退出登录，API200；再进资料页GET401，只出现登录提示，没有编辑输入 | PASS | logout-anonymous.json、acceptance-anonymous-profile-568.png、profile-http-receipts.json |

## 数据隔离与清理

只创建临时普通用户 `profile_check_f13165ec`（id见provision.json），没有开会员、写评论、点赞或触发邮件。实际头像使用已有隔离内容PNG，不新增合成fixture、不修改源图。初始4项媒体ID用于精准归属判断，不备份业务库。

实际logout已撤销自身会话，清理前自身sessions=0。按精确user id删除临时用户；只删本次新建且users/content_media/contents/collections四类引用均为0的头像资产及其`avatars/<sha>.webp`文件。旧4项媒体、用户preview_test及其会话、7篇内容、1合集、1评论、1权益、1兑换记录保持。清理前后所有其他业务与统计数量一致；删除临时0600凭据文件，自己的tab已关闭，CDP网络阻断与尺寸覆盖均已解除。详见cleanup.json。

**匿名统计清理 UNVERIFIED：** 资料页本身没有内容统计目标，登出前所取`yoryon_analytics_sid`为null；登出会导航首页，我在再次读取SID前关闭了自己的tab。关闭后自身CDP请求缓冲无法读取。初次清理owner guard因此拒绝且未执行任何删除。后续仅清理可确证的用户与头像，保留全部181条匿名统计，未根据时间、数量或最新SID猜测归属。可能存在本次登出首页产生的统计记录，无法确认或精准移除。

## 范围与未覆盖

没有测试生产环境、真实用户或邮箱、所有浏览器兼容性、长时间15秒超时与中途卸载竞态、动画图片/损坏图片解码、2MB精确边界、40个emoji边界。成功上传用例是现有PNG，JPEG只执行了超2MB可见拒绝路径；成功JPEG/WebP上传未现场覆盖。没有改动主题偏好；保持原来的浅色，深色本轮未验收。本文只证明所列真实路径。类型检查和构建由主 agent 单独记录。

## 截图说明

`preview-profile-568.png` 是独立 agent 的实际临时验收账号截图，未改写为用户preview_test，不是静态生图。`preview-user-profile-568.png`由主 agent提供用户交付预览。内置截图包装器在CDP尺寸覆盖下曾返回595×335缩放图，已舍弃该错误比例工件，最终用自己tab的原始`Page.captureScreenshot`明确clip568×896取得原图，没有任何后期编辑。

复验环境、实际命令与现场步骤见 acceptance-commands.md；不存在新增的可执行测试程序或固定断言套件。
