# 列表滚动恢复

基于当前未提交工作区，版本、隔离环境与最终运行目录见 environment.json。隔离 API 4117 / Web 3117，25 篇公开副本，无生产修改。

实现：导航来源绑定的滚动记录；history 后退/前进恢复；追加列表 layout effect 恢复，当前列表版本+初始游标一致才复用；公开完整短帖展开 ID 记忆；普通链接和刷新使用独立策略。存储禁用时不主动设 manual。

执行：仓库 `pnpm typecheck` PASS；加载 environment.json 中私有 envFile 后在 buildWorkspace 执行 `pnpm build` PASS；`git diff --check` PASS。日志 typecheck.log、build.log。不要将私有环境内容复制进工件。

复现步骤：进入 localhost:3117，滚动到底部触发追加25条；选择追加文章，浏览器后退并比较离开前后的 scrollY、文章条目与第一帧列表画面；前进详情后再次返回；重复页面内返回；在列表展开公开短帖后重复。正文与列表取自现有隔离数据，不引入固定测试程序。

独立现场验收结果及命令、帧序列见 acceptance/。

## 验收发现与修正

首轮独立验收发现页内返回缺失 history 来源：在 layout effect 绑定来源早于 Next 的 history 提交，随后被覆盖。修正为 passive effect 在提交后绑定来源；列表还原仍留在 layout effect。另在 popstate 取消尚未结束的键盘/平滑滚动，避免动画跨页。以独立验收的最终复验结果为准，不将首轮构建成功视为业务通过。

第二轮确认流式正文提交仍会覆盖自定义 history 字段，故最终实现删除该依赖：同文档导航来源保存在根 React Provider 的有界 Map；页面内返回仅对真实记录的来源使用 history.back，新标签/刷新则回退安全首页。

最终定位机制在 layout commit 中立即执行；追加批次的 layout-ready 事件补足高度后再次立即定位，不强制等待一帧。导航监听使用稳定的 passive effect，定位使用路由 layout effect，避免 Suspense 隐藏时断开全局导航监听。popstate 使用 capture 阶段先记录来源和恢复请求，再由路由提交恢复。
