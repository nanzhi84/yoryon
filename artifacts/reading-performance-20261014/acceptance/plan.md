# 独立现场验收计划

2026-10-14，工作区 `/Users/yoryon/Projects/yoryon`。按当前 AGENTS.md，现场选择实际公开文章和帖子，经项目 CLI 发布进本轮独立数据库/FS，再操作当前构建。本文是动作和判定依据，不是固定测试套件或可执行断言程序。

## 失败方式与边界

- 首页展开：点击后长期无响应；正文解析/布局导致主线程阻塞；正文缺尾段；缩回后文字或焦点丢失；重复展开重复发请求；两个帖子状态互相污染；获取失败没有反馈/重试；移动窄屏溢出。
- 文章标题导航：等待个人身份串行请求后才显示公开正文；点击无即时反馈；匿名路由预取请求过多；返回丢失已追加页、展开状态或滚动位置；付费内容被公开预取；过期/退出后旧私人正文泄露。
- 自动分页：接近末尾仍需点击；相同游标重复并发；错误状态循环重试；网络失败丢掉旧条目；版本失效混入不同快照；返回到列表立即无界加载；结束仍请求；无 IntersectionObserver 没有可操作退路；键盘无法触发退路。
- 重复链接删除：首页仍显示阅读全文；删除后标题/评论入口不可访问；标题被嵌套交互拦截。
- favicon：head 注入错误；ICO/PNG/apple icon 内容与页头头像不一致；图标404、MIME不符或尺寸不符。
- 认证/授权只在本轮隔离环境中创建自己的账号和权益；不向真实用户发信，不向生产写业务数据。

## 环境前提

- PostgreSQL 容器 `deploy-postgres-1`，宿主机 `127.0.0.1:54320`，仅新建数据库 `yoryon_reading_performance_20261014`。
- API `127.0.0.1:4117`；Web `http://localhost:3117`；新 FS 根目录见 environment.json。
- 私密随机配置仅存在0600临时文件，任何密钥、认证cookie和连接串都不进入工件。
- 使用 Node/pnpm 当前项目的 migrator 与 publish CLI。先确认 `current_database()` 再执行每个写动作。
- 浏览器优先新建 IAB 标签；若平台不提供浏览器控制，UI体验/事件时延保持 UNVERIFIED，不以HTTP或构建成功替代。

## 初始浏览器回执

1. `cua.getState()`：本验收chat只列出 IAB/MCP Apps，各0个tabs。
2. `cua.createBrowserTab('iab','https://yoryon.com/',{visible:false})`：45秒超时，工具提示 kernel reset。
3. `cua.createBrowserTab('chrome','https://yoryon.com/',{sessionName:'🔬 阅读性能验收'})`：Browser is not available: chrome。

未操作用户Chrome标签。后续将继续尝试可用 IAB provider，并记录是否解除限制。
