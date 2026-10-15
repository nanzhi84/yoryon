# 本次生产只读验收的复查顺序

前提：目标提交 `a9880ef7f3ce4cd407ce1f96467f285c0686d8b6` 已部署API并promote到主域名；使用匿名公开访问，不创建生产数据、不登录、不点赞、不评论、不发邮件。本次已有生产样本分布记录于 `baseline-inventory.json`。当前内容以后可能变化，应先重新读取清单，不能把冻结数量当永久断言。

## 公开API与媒体字节

以下为本次现场实际访问的公开GET路径，可用curl复查；请求不携带凭据。保存工件时只记录业务结果、状态、cache、哈希，避免把媒体重定向的签名URL写入日志。

```sh
git rev-parse HEAD
git ls-remote origin refs/heads/main
curl -fsS https://api.yoryon.com/api/feed
curl -fsS https://api.yoryon.com/api/post-feed
curl -fsS https://api.yoryon.com/api/collections
curl -fsS https://api.yoryon.com/api/collections/first-internship-diary
curl -sS https://api.yoryon.com/api/auth/me
curl -fsS https://api.yoryon.com/api/contents/first-internship-day-18
curl -fsS https://api.yoryon.com/api/contents/note-2026-09-09-1
curl -fsS https://yoryon.com/api/pages/ecadd86b-0c12-4470-8eeb-e59c95aedd30/feed/start
curl -fsS https://yoryon.com/api/pages/ecadd86b-0c12-4470-8eeb-e59c95aedd30/post-feed/start
curl -fsS https://api.yoryon.com/api/public/image-policy/dc52ff09-4a00-410e-ae72-5285f66e4568
curl -fsSL https://api.yoryon.com/api/media/dc52ff09-4a00-410e-ae72-5285f66e4568 | shasum -a 256
curl -fsS https://yoryon.com/api/images/v2/dc52ff09-4a00-410e-ae72-5285f66e4568/320 | shasum -a 256
```

本次实际执行采用一次性Python heredoc：`urllib.request` GET上述API/公开图片与全部4篇封面、1个合集；将发布后slug按类型与`baseline-inventory.json`比较；分别算原始媒体/主域名WebP的SHA256并与image-policy哈希比较。没有保存可执行验收程序，精确结果在`api-after-promotion-independent.json`。内容version应使用重新GET返回的值；冻结命令里的version不是部署版本。

专属deployment URL匿名GET最终是`vercel.com`登录页，不能用它的200或静态资源集合判断主域名应用版本。使用部署控制面READY/commit/alias回执与主域名实际浏览器页面分别核对。

## 内置浏览器的实际用户路径

本次创建专用隐藏@Browser标签，初始打开`https://yoryon.com/`；未复用或导航用户已有标签。通过公开页面链接继续，捕获截图并用只读DOM查询测量。

1. 首页读取全部9个article，核对4个实际img与5个“暂无封面”占位，标题和封面同顶，日期在文字下方、互动前。桌面封面112×84，标题与封面的top相等；保存`home-independent-desktop.jpg`与`home-independent-dom.json`。
2. 点击“帖子”tab，等待日期链接实际出现，记录16条现有帖子、无文章类型；保存`posts-independent-desktop.jpg`和`posts-independent-dom.json`。
3. 定位正文“我最近在重新搭一个学生项目”的帖子，记录高度594px；点击“展开”，观察完整末段及“收起”按钮、高度1050px；再点击“收起”，恢复594px。保存`posts-expand-independent.json`与`posts-expanded-independent.jpg`。不以API的collapsed=false否定浏览器原有的前端折叠。
4. 点击“查看2026.09.09的帖子详情”日期链接；必须等待完整末段出现，不能把“文章加载中”当成功。保存正文截图及`post-date-independent.json`；返回帖子页。
5. 点击“合集”，等待封面img `complete && naturalWidth>0`。目录展示已有阅读进度时按钮可能叫“继续阅读”；不强行期待“开始阅读”。直接点击目录“01 AI PM实习Day 1 …”链接，确认文章详情正文、下一篇和返回合集入口。保存`directory-independent-dom.json`与`chapter-independent-dom.json`。
6. 使用浏览器viewport capability分别设390×844、320×844，检查首页/帖子/合集scrollWidth等于viewport，无水平溢出；首页/合集封面88×66，日期位于文字下方。导航首页→帖子→合集→订阅，320px每个主tab目标至少44px，探索SVG向下。截图见`*-independent-mobile.jpg`及`*-independent-320.jpg`。
7. 最终图片截图必须等真实img加载完成后保存，不能把临时加载背景当缺图占位。`collections-mobile-independent-dom.json`和`collections-320-independent-dom.json`是加载完成的最终记录。
8. 读取页面`dev.logs({levels:['error','warn']})`保存`browser-independent-runtime.json`；本次结果[]。重置viewport、关闭自己的标签，保存`browser-cleanup-independent.json`。未添加网络阻断或延迟。

照片均为实际生产页面，未用设计生成图冒充运行结果。各自第二页、生产媒体帖与远端展开没有现成样本，保留UNVERIFIED；独立隔离环境的对应行为与重建步骤在`../../unified-entry-20261015/acceptance/report.md`及同目录`reproduction.md`。
