# 帖子指标独立现场验收

本目录记录本次临时操作，非固定测试入口。隔离 PostgreSQL 为 deploy-postgres-1:54320 / yoryon_post_analytics_20261015，API 4030 / Web 3030；独立 fs storage 与随机密钥配置在 0600 临时文件 /tmp/yoryon-post-analytics-6PzKt2/acceptance.env，未读取生产业务库。Mailpit11025，不发真实邮件。

## 数据与实际准备

- docker exec deploy-postgres-1 createdb -U postgres yoryon_post_analytics_20261015
- apps/api: node --env-file=<临时env> --import tsx src/migrate.ts，应用当前唯一迁移实现。
- 临时 posts/short-note、long-note、ordinary-article、paid-note 现场新写 index.md，分别短公开帖子、28段公开长帖、普通文章、20段30%付费预览帖子；各独立tag，paid show_in_home=true。
- apps/cli: node --env-file=<临时env> --import tsx src/index.ts publish <各自目录>，提交成功；Web未开时cache pending，不以命令成功为浏览器通过。

## 实现前选定的失败方式和边界

1. 首屏小于5秒无read，恰跨5秒后有read；累计4秒→滚出→恢复只补剩余时间，滚出停留不累计；曝光连续不足1秒移出应重置。
2. 长帖真实展开即时read；满5秒再展开、展开后长停留不重复；失败展开不能假read；重载新列表实例可新计。
3. 初始隐藏无曝光/read，前台累计与隐藏暂停；DNT/GPC缺省拒采。原生后台能力不足则明确WebAPI SIMULATED。
4. 同一列表实例重复进出不重复；文章仍详情10秒和旧Click/View，帖子详情无Click/View/Read。
5. 标签页和subscription仍为原有不采集表面，paid预览首页5秒可记展示阅读，不能称全文已阅读。
6. 真实浏览器→同源BFF→API→SQL/CLI；旧事件不删除，当前帖子报表只展示两个指标，API拒绝帖子click/view和非home read。

即时展开补验重新创建同名空库和新临时目录，仅publish immediate-note；同构建产物无重build。浏览器实际534.9ms内完成首页导航、展开、hiddenflush；SQL只read1。新环境随后同样清理。

## 重建环境与交叉核对

临时配置已删除，复现需新建0600配置，不复用生产.env。配置方法可参照仓库.env.example和前次隔离环境说明（artifacts/issue-26-20261015/reproduction.md），但必须改为本次数据库和端口：PORT=4030，API_PUBLIC_URL/API_INTERNAL_URL=http://127.0.0.1:4030，SITE_URL/ALLOWED_ORIGINS=http://localhost:3030，CACHE_REVALIDATE_URL=http://localhost:3030/api/revalidate。STORAGE_BACKEND=fs，FS_STORAGE_ROOT指向新的专属目录。BFF_SHARED_SECRET、FS_STORAGE_SIGNING_SECRET、CACHE_REVALIDATE_SECRET分别生成随机值，仅写入临时配置；MAIL_SMTP_HOST=127.0.0.1、MAIL_SMTP_PORT=11025；DATABASE_URL只指向上述本地空库。

从apps/api运行上面的迁移命令；从apps/cli发布新写正文的index.md目录。短帖用一段短正文，长帖用28段，确保真实页面出现展开按钮；即时补验用24段、slug=immediate-note。frontmatter按README.md内容包约定和packages/core/src/publish.ts的frontmatterSchema设置type=post、visibility=public、show_in_home=true；文章改为type=article并给标题；paid-note设置visibility=paid、preview.mode=percent和preview.percent=30。不要从生产导入内容。具体正文无需固定，几何与展开是否可用须在现场确认。

启动及构建命令见independent-acceptance.md；隔离env必须注入API、CLI、构建及next start各进程。启动后执行cache retry，再实际浏览http://localhost:3030/。每次需要新列表实例时完整重新导航首页，不通过替换Observer或计时器制造结果。

实际SQL通过以下psql入口检查；只输出slug、事件种类、placement和聚合数，不输出visitor/session标识：

```sh
docker exec deploy-postgres-1 psql -U postgres -d yoryon_post_analytics_20261015 -P pager=off
```

```sql
select c.slug,e.event_type,e.placement,count(*)
from analytics_events e join contents c on e.target_kind='work' and e.target_id=c.id
group by c.slug,e.event_type,e.placement order by 1,2,3;
```

滚动场景先使短帖至少50%可见，记录4秒后滚出，等队列投递再查SQL；回到相同卡片补足余下时间，再查SQL及CLI。即时展开场景使用仅一篇新长帖的空库，从非采集页面导航首页、真实点击展开、核对正文和“收起”按钮，在5秒内隐藏页面以flush，并保存单调时钟耗时及SQL。后台／隐私模拟步骤与限界见独立报告，不将其等同原生设置验证。

清理本次专属数据库、配置/存储/正文目录和4030/3030服务；只关闭任务自己创建的浏览器标签。每次生成新运行目录保存现场回执，不把本目录作为固定断言套件。
