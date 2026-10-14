# React/实现边界检查

依据已应用的vercel:react-best-practices与verification技能。三个视图文件，89/6/6行，未加依赖。

- Avatar默认28、个人资料64的明确两个用途，旧评论头像尺寸不改；首码点保留合法emoji。
- file picker由真实button触发、input sr-only/tabIndex=-1/accept/disabled，可访问名称/描述存在；可见按钮/input44px，focus ring沿用，表单label绑定与helper id绑定。
- 初始加载GET和变更POST/PATCH/DELETE都有15秒超时；卸载取消。请求ref立即锁住并发，pending表达具体操作，finally恢复控件；API错误消息作为React文本呈现，网络错误不泄露原异常。
- 自动保存头像只setProfile、不重置name草稿；名称保存使用原接口再采用服务端规范化返回；加载/匿名/失败重试保留。
- 不修改API/身份/安全/存储语义；角色/权限仍服务端执行。username只读从当前profile投影显示，未添加新字段或客户端API旁路。
- 首次typecheck与build并发导致Next重新生成types/cache-life.d.ts时TS6053，原回执保留；build成功后单独重跑typecheck-final.log，避免锁定生成中间态。此为检查执行顺序问题，不改源码/忽略类型来规避。
- 真实保存/上传/删除/媒体字节与持久化验收由独立agent处理，构建不替代业务结果。
