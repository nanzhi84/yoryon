# Issue #26 独立验收与代码审查

状态：环境已准备，等待实现齐备。此文件仅记录现场验收，没有固定测试程序。

需求来源：[Issue #26](https://github.com/nanzhi84/yoryon/issues/26)，完整正文见 `issue.json`。

## 隔离前提

- 数据库：`yoryon_issue26_20261015`；通过现有本地容器 `deploy-postgres-1`（127.0.0.1:54320）新建空库。没有读取生产配置、复制真实用户或写生产业务数据。
- 配置：`/tmp/yoryon-issue26-HJGFGZ/acceptance.env`，0600；只包含独立本地配置与临时密钥，不纳入工件。
- 媒体后端：现有 fs，独立根目录 `/tmp/yoryon-issue26-HJGFGZ/storage`。实际 OSS 私有桶与生产签名链路本次未验证。
- API：4026；Web：3026；Mailpit：11025/18025，仅捕获本地 `example.test` 地址。本次不向真实用户发信。
- 源码：`/Users/yoryon/Projects/yoryon`；分支 `codex/issue-26-collections`，验收前后记录实际 SHA 与工作区差异。

## 现场用户路径与失败方式

1. 真实 CLI 创建合集，发布独立文章／短帖、合集内章节；查询首页及目录，显式开关首页展示并重新发布，核对数据与最终页面。确认关联、权限、首页展示独立。
2. CLI 修改合集资料、置顶／取消置顶、编辑旧章、新增章与多合集成员；核对更新时间、排序、缓存事件及章节序号。选择同时发布／排序路径观察共享发布锁下的结果。
3. 真实封面上传、更换、无封面、共享正文媒体；从匿名页面取得媒体、核对实际字节。触发上传／关联失败并核对原关联；GC dry-run 与 apply 后核对仍被引用的媒体。OSS 桶直链限制列为 UNVERIFIED，不能由 fs 成功推导。
4. 浏览器桌面与移动端：导航／探索折叠标签、卡片、详情、唯一阅读按钮、空态、正倒序目录、首尾上下章、返回合集，以及单篇互动保留。
5. 本地续读：首次、前台正文展示、刷新、重读旧章、新章／编辑不移动位置、损坏／禁用存储、撤回／删除章、多标签页、多合集与直接作品入口。会员锁定预览不能改写阅读位置；目录点击或预取不能替代真正阅读。
6. 权限：匿名／普通用户／有效与过期权益、会员正文和媒体，直接 API 请求核对 no-store。数据与会话只保存在 /tmp，不进入报告。
7. 浏览器→API→SQL→CLI 流量：可见曝光／主动标题与封面点击、详情 View；跨目录与章节前台计时、后台暂停、锁定预览、返回与上下章去重、独立流程隔离、多合集与无效上下文。用真实操作再核对事件类型／目标与报表，不以 API 接收成功代替行为成立。
8. 失败隔离／隐私：重试 event_id 幂等、有界失败、DNT/GPC、零分母 N/A，未解锁响应与工件无敏感正文／凭证／原始访客标识。

## 已执行回执

```sh
gh issue view 26 --repo nanzhi84/yoryon --json title,body,url > artifacts/issue-26-20261015/issue.json
docker exec deploy-postgres-1 psql -U postgres -d postgres -Atc "select datname from pg_database where datname='yoryon_issue26_20261015'"
docker exec deploy-postgres-1 createdb -U postgres yoryon_issue26_20261015
```

数据库创建前查询为空，创建成功；端口 4026/3026 准备时没有监听者。临时配置由 Node crypto 生成随机密钥并设 0600，无密钥输出。

## 结果

| 范围 | 状态 | 证据／边界 |
|---|---|---|
| 隔离环境准备 | PASS | 新空数据库、专属临时目录、随机本地密钥；尚未迁移或启动 |
| 业务路径 | UNVERIFIED | 等待实现齐备 |
| OSS 私有桶真实上传／签名 | UNVERIFIED | 未使用生产密钥；fs 不能证明 OSS 行为 |
| 生产部署 | UNVERIFIED | 用户明确要求暂不部署 |

