# React检查

本轮按已读取的 React best practices 清单检查最终组件。

- 音频元素与控件持续挂载，播放/暂停是状态更新；原生media事件根据当前paused与播放意图同步，显式暂停立即更新UI，避免排队事件复写旧状态。只在用户手势加载音频，离开视口/卸载释放资源；网络只自动重试一次，有15秒超时和手动重试。
- 搜索异步请求有AbortController、15秒超时和generation隔离；结果点击与所有pagehide入口在冻结前同步清除正文snippet并取消未完成请求，仅存查询/会话/已加载页元数据。返回重新按服务器会话校验身份、内容修订与权限；登录/退出清空记录，BFCache恢复重新读取空记录。
- 公开feed分页缓存绑定catalog version和初始cursor。收藏/标签/摘要仍是匿名公开DTO，付费摘要由现有publicPreview边界裁剪；无新增共享可变服务状态。
- 图片使用原生dialog提供键盘ESC和焦点归还，视觉仅图片居中；关闭后恢复body滚动状态。按钮都有可读名称与键盘焦点样式。
- 订阅tab包含aria-selected、aria-controls、tabpanel和方向/Home/End键盘切换；作品通过Server Component slot进入，问答仅首次打开后挂载保留状态。
- 账户认证请求no-store；匿名/已登录/加载/失败分别显示正确入口，退出失败保留已登录状态并提示，实际注销后刷新页面。
- 主题只支持light/dark；单按钮menuitemcheckbox公开当前状态。新导航/搜索/返回不引入全站Provider或额外依赖。
- 根工作区pnpm typecheck通过，最终独立副本pnpm build通过；44个变更TS/TSX文件无超过500行，git diff --check通过。静态结果不代替真实UI验收，独立结果见acceptance.md。

未引入单元测试、固定断言脚本、合成fixture/harness或测试专用生产钩子。业务验收由独立agent现场执行并留存回执。
