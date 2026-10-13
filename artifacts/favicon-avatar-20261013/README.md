# 头像 favicon 发布验收

2026-10-13 Asia/Singapore。结论：生产 yoryon.com 图标变更 PASS。

输入：用户指定 `/Users/yoryon/Downloads/图片/头像.jpg`（1728×2304）。Sharp自动读取方向，中心等比例裁剪到正方形512×512，去除原图元数据；生成 icon.png512、apple-icon.png180、PNG载荷ICO16/32/48。原始照片不改写、不上传到仓库。

当前生产前端原版本 `ab6e744978502e12cc52bbbc6d55634d6b0620b4`、部署 `dpl_HuWBaXirxB1K3e23PmrHWmHoF5Fr`。新增三个 Next 原生 app 图标文件，复用自动head元数据生成，没有修改布局/页面/业务逻辑或配置。

发布源码 `183a61c5fce58b059dd68b24a728ad851e607819`，分支 `codex/favicon-avatar`。只增加 `apps/web/app/favicon.ico`、`icon.png`、`apple-icon.png`。后续发布更新的main前端时，应合入该三资产提交，保留本次用户图标选择；不将旧版整站代码反向覆盖main。

实际 `pnpm install --frozen-lockfile`、`pnpm typecheck` 退出0。以现有独立 Hobby 项目 yoryon-web、明确团队scope先staged production：

```sh
vercel --scope zyy2740738166-7111s-projects --project yoryon-web --prod --skip-domain --yes --no-wait
vercel --scope zyy2740738166-7111s-projects inspect dpl_ABGFrhZkp5wfBsR2cmQP3rxW4ZJH --logs
# 独立agent stage资产/首页→文章验收通过之后：
vercel --scope zyy2740738166-7111s-projects promote dpl_ABGFrhZkp5wfBsR2cmQP3rxW4ZJH
```

候选部署 `dpl_ABGFrhZkp5wfBsR2cmQP3rxW4ZJH` READY。独立stage验收后promote返回Success，生产yoryon.com/www.yoryon.com采用该部署。完整构建日志 build.txt。没有部署API、做业务数据迁移或发邮件。

独立agent在自建隐藏内置浏览器访问首页并真实点击文章；核对两页面head三个图标链接。最终匿名下载生产ICO/PNG/Apple图标，SHA256分别与183a61c源资产完全一致，尺寸正确；现场页面截图、head JSON、远程资产及哈希回执在本目录。全部自建浏览器tab关闭。详见 independent-review.md 与其证据索引；不新增固定测试程序。

阶段性状态：staging匿名CLI请求受Vercel保护，未将保护HTML当成图标；用真实浏览器资源回执验证。生产一次TLS EOF以有界重取成功，没有关闭TLS校验。评论加载失败在旧生产同样出现，属于已观察的基线现象，本次图标范围没有修复或新增评论变更。

未覆盖：用户已有收藏夹的缓存刷新、iOS实际添加主屏流程及全部浏览器引擎，不把原生icon链接/尺寸验证当作这些路径全覆盖。

回滚：`vercel --scope zyy2740738166-7111s-projects rollback dpl_HuWBaXirxB1K3e23PmrHWmHoF5Fr` 可回到发布前站点；不涉及数据还原。回滚后的自动域名分配按Vercel行为另行核对。
