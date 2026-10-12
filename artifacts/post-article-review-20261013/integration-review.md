# 1629194 最终整合差异 review

精确HEAD：`162919403b10760f6dd06be5cab17d255d65cb59`。源码相对独立已验06591b0只有5个API文件变化；新main合并本身相对已有整合仅工件变化。未修改任何产品源码。

静态结论：无新阻断项。Hono子应用路由会展开到同一/api，原跨模块 `app.use('*')` 已换成匹配本模块路径的中间件；question bodyLimit仅作用POST/PATCH问答，不再拦截头像。身份线默认private/no-store覆盖身份错误和不存在响应，公开线及公开媒体自行声明既有缓存策略。鉴权、问答私密投影、post/article正文、迁移与引用关系没有改变。

实际运行主代理1629194完整build输出并重启API4461/Web3161。主代理静态检查日志exit0；reviewer实测差异结果：

- feed、paid-feed、public/contents、content comments仍返回public缓存头；带admin身份的public paid内容仍preview，无私有探针。
- admin私有paid详情full，private/no-store；普通账号评论context锁定，private/no-store；me/profile匿名401、未知身份线路由404、非法media与avatar404均private/no-store。
- image-policy路由保持private/no-store，未被其他模块覆盖；问答、membership身份投影继续private/no-store。
- 197301字节PNG头像实际成功上传，读取后格式WebP、320×320，随后DELETE清头像指针。超2MiB头像413，问答超32KiB413。直接Undici发送过大体出现early-close，使用HTTP逐响应取得413回执；不把transport抛错当实现缺陷。
- 普通账号paid浏览器详情无私有正文、无新增评论输入；已有post/article评论与普通用户输入可见，实际点击合集上一篇到正确作品。
- 手动引用重试已补齐：资源阻断→真实错误DOM→仅聚焦重试按钮→解除单资源阻断→在已聚焦按钮上Return。唯一目标请求发起栈包含onClick，200恢复正确card。与先前focus自动恢复分开。

证据：`integration-1629194-api.json`、`browser-integration-*`、`source-integration-1629194-sha256.json`、`runtime-integration-1629194-sha256.json`。最终runtime索引含API/CLI的JS bundle、Next BUILD_ID及手动重试请求栈涉及的两个实际chunk。

迁移/旧预览矩阵继续复用69344c7完整验收，06591b0负责导航/comment最终抽验；五文件差异未改变其领域代码，不重复整套无变化矩阵。生产网络/真实OSS、>100直接引用者恢复、全部并发组合仍未验证。环境收尾见 `cleanup.json`。
