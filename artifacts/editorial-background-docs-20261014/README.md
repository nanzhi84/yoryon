# 背景与Markdown文档

页面浅白#ffffff、深色#151514，globals.css仅改background/canvas及说明注释；品牌按钮与其他tokens保留。docs/markdown-rendering.md新增完整当前规则，README入口与architecture8.3同步。

环境与版本沿用../editorial-layout-20261014/environment.json、version.txt，源码含本会话既有未提交改动。独立dev/build副本已同步背景CSS。隔离API4115/DB yoryon_page_redesign_20261013/FS存储可用，preview.env仍保持私有。

静态命令根目录pnpm typecheck，typecheck.log通过；构建在独立build-workspace执行pnpm build，build.log通过。详细env-file构建命令沿用前轮README，未新增依赖、迁移或测试脚本。

预览启动在dev副本apps/web：

```sh
ALLOWED_ORIGINS=http://localhost:3016 SITE_URL=http://localhost:3016 node --env-file=/tmp/yoryon-page-redesign-m0NxxV/preview.env /Users/yoryon/Projects/yoryon/apps/web/node_modules/next/dist/bin/next dev -p 3016 -H 127.0.0.1
```

浏览器现场复生成：访问3016文章，读取body实际backgroundColor；用账户菜单深色外观切换，观察背景、标题、卡片、图注，结束恢复浅色。验收来源见acceptance.md及main-agent-browser-evidence.md；独立agent直接核对文档与源码，主agent提供真实浏览器截图/参数并由其独立复核。不写生产/邮件/业务内容。
