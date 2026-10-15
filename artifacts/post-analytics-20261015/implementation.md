# 帖子信息流统计变更

分支：codex/post-feed-analytics；Web/API源码提交62c20cd，最终CLI标签和文档补丁bad8f13。生产环境未部署或执行迁移；无新增依赖、数据库DDL、固定测试程序。

## 用户确认的合同

帖子只保留曝光与有效阅读：可视面积至少50%连续1秒曝光；可视面积至少50%累计前台5秒有效阅读，滚出视口或后台暂停。主动成功展开正文立即满足同一个read；展开本身没有独立事件。同一列表实例同一帖子曝光和read各至多一次。点赞评论继续使用业务数据库。文章口径保持。

## 模块和数据流

- PostAnalytics复用原TrackImpression；独立IntersectionObserver拥有累计停留、一次性timer与资源释放；context仅暴露read回调。PostEntry在本地展开或远程校验成功后调用；自动恢复展开和加载失败不调用。
- 旧TrackClickLink增加显式enabled，帖子日期/评论仅导航；WorkDetailProvider对post禁用，详情仍正常阅读和互动，合集ChapterReading仍处理自身流程。
- 帖子read以原placement列的home_feed区分旧详情read。API查询已发布目标实际type，拒绝post click/view/read(NULL)及article/collection read(home_feed)。沿用事件队列、限流、白名单、event_id幂等、访客首次观察事务及隐私规则。
- CLI查询排除现存post的旧详情指标；帖子read_rate=reads/impressions，click/view/ctr为N/A。overview按post/article/collection分组；已删除类型未知的作品单列历史数据，不推测。原始历史事件不修改。

## 主agent检查

- pnpm typecheck：PASS，实际输出typecheck.txt；未以此替代浏览器验收。
- git diff --check：PASS。
- React Best Practices自查：无新增请求瀑布；读数状态使用ref，不逐tick重渲染；callback依赖稳定列表实例；Observer/timeout/visibility listener卸载释放；展开回调来自真实交互成功路径；无新增全局可变React服务端状态。
- 手写修改文件均低于500行；不扩大tag/subscription采集范围，不改变认证、授权和互动数据。

## 已知口径边界

严格采用卡片面积50%，超高卡片在小视口可能无法达到阈值；主动展开仍可计阅读。快速展开可能早于连续1秒曝光，不能补造曝光或将比例强行封顶。付费预览的有效阅读仅指当前展示内容。切换前后的阅读口径不可直接比较；已删除作品缺少类型不能严格重分历史。

独立现场结果、运行环境、临时数据重建和清理见本目录独立验收报告与reproduction.md。未验证范围以独立报告为准。
