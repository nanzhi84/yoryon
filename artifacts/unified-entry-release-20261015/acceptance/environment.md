# 统一入口生产发布独立验收前提

验收范围：浏览器导航→生产公开API→已有生产内容→入口/详情与媒体。主agent负责commit/push、先部署API后部署Vercel；本agent不发布、不改代码、不创建生产内容/身份/权益、不发邮件。浏览器阅读可能产生产品自身正常analytics事件，不额外伪造事件或写入业务数据。

## 发布前基线

2026-10-15 21:21–21:22（Asia/Singapore）。公开生产目标https://yoryon.com、https://api.yoryon.com。实际HTTP元数据见baseline-http.json。旧首页API版本ecadd86b-0c12-4470-8eeb-e59c95aedd30；/posts和/api/post-feed都是404，页面尚无帖子tab。

旧混排feed共25条（20+5）：article9、post16。文章4有封面/5缺图；生产帖子media0，collapsed0。1个合集first-internship-diary，37篇全为article。完整已发布公开列表前提见baseline-inventory.json。

因此分类型上线后每类均不足20条，不可现场验证各自第二页；当前生产没有帖子媒体与远端折叠样本，不能凭原代码一致声称已经在生产媒体帖验收。相关边界标记UNVERIFIED并引用本次先前隔离验收，绝不向生产补造样本。

## 实际准备命令

```sh
git rev-parse HEAD
# 发布前为750c494cf9bfb41ed282fbfac152aee3bf8b0759
curl -sS https://yoryon.com/
curl -sS https://yoryon.com/posts
curl -sS https://yoryon.com/c
curl -sS https://api.yoryon.com/api/feed
curl -sS https://api.yoryon.com/api/post-feed
curl -sS https://api.yoryon.com/api/collections
```

现场通过Python urllib请求上述URL、提取HTTP status/cache/server/date/version/types，去除非必要正文和所有潜在签名/身份数据，输出baseline-http.json；再跟随feed nextCursor直到null，读取合集详情，聚合已有样本，输出baseline-inventory.json。仅执行GET。

## 浏览器可用性

子agent创建IAB标签时返回Browser is not available，cua.getState返回browsers=[]。未切换Chrome、未读取用户已有标签或登录态。上线后再确认一次；若仍不可用，由主agent执行公开桌面/手机浏览器路径并保存截图，本agent独立审查截图/API，明确区分直接验收与转交证据，不能把HTTP当作浏览器验收。

## 计划与停止条件

等待主agent提供API运行版本与Vercel部署ID/URL后再判断发布后状态。验收首页仅article且9条无重复，posts仅post且16条无重复，既有内容slug集合不丢失；文章/合集4:3及缺图占位；导航顺序与探索向下；入口→详情→返回；公开图片读字节；当前数据可触发的本地展开；浏览器自然analytics的post_feed归因。先报告第一个实际断点，交主agent修复后再核验；未覆盖项单列。

不使用固定测试程序、合成fixture/harness或人为断言数量。工件记录实际公开内容、可重复命令、部署版本和必要截图，不包含cookie/token/签名URL/用户隐私。

主agent提供待部署源码commit：a9880ef7f3ce4cd407ce1f96467f285c0686d8b6。该值目前是发布目标，尚不等于运行中实例版本；等待API部署回执与Vercel部署metadata匹配后再报告上线。主agent的IAB可用，将由主agent执行浏览器桌面/手机路径并保存DOM/截图供独立审查。

API部署后检查已于2026-10-15 21:36（Asia/Singapore）完成，独立公开GET结果见api-after-backend.json。主agent提供运行镜像yoryon-api:a9880ef及sha256:114d36aafd3c8166d369384346580bfddee73c59fd67febe9e9874515f7f1466；验收只将其标为主agent部署回执，公开API响应本身没有commit/digest标识。目录version仍是内容版本ecadd86b-0c12-4470-8eeb-e59c95aedd30，不能把内容version当部署代码版本。
