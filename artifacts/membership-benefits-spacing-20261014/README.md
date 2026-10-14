# 本地会员权益与间距调整工件

## 环境与版本

- 工作目录：/Users/yoryon/Projects/yoryon；现有未提交改动保留，未提交/推送/部署。
- HEAD 和冻结源码哈希：source-manifest.json。当前回合21处视图文件的差异：current-turn.patch。累计工作树差异implementation.patch仅作证据。
- Web http://localhost:3015/，API http://127.0.0.1:4115；隔离数据库yoryon_page_redesign_20261013、存储/tmp/yoryon-page-redesign-m0NxxV/storage；Web PID11163 / API62175。冻结目录和配置文件路径见environment.json，不保存配置内容。
- 常规正文 top20px，返回44px/mb8px；会员权益三列图标/标题/简述；页面同背景。完整设计与边界design.md。
- 独立验收发现既有未知尺寸图片响应式候选/自然尺寸导致返回后布局收缩；必要修正只涉及MarkdownImage/MarkdownSurface。最终实测图集532×299.25、保存/返回scrollY777.5和标题top435一致，详见独立报告。未知尺寸冷加载的全局CLS不在通过声明内。

## 复现与验证

需要上述隔离服务/现有演示数据与现有pnpm依赖；从preview-workspace-final.txt指定目录以implementation-commands.md的命令重新构建/启动。使用独立@Browser页签595×896按acceptance-commands.md重走实际浏览路径；不维护固定测试/fixture/harness。

- pnpm typecheck：PASS，typecheck-final.log。
- 隔离配置下pnpm build：PASS，build-final.log。原有::highlight(search-hit) CSS优化警告保留，不影响本次构建；构建成功不代表业务验收。
- React/边界检查：react-review.md；68项累计改动与冻结源码全部匹配source-manifest.json。
- 主agent最终595×896真实PNG：preview-subscription-595.png、preview-redeem-595.png。普通CUA截屏在CDP viewport下会缩放，最终PNG通过同一独立tab的CDP Page.captureScreenshot显式clip生成，没有编辑像素。
- 独立现场结果/未覆盖边界：acceptance.md；现场截图与测量以acceptance-*文件留存。自身搜索数据清理PASS/浏览统计清理UNVERIFIED回执cleanup.json，root无SID/无DB操作见root-preview-cleanup.json。

本工件只证明所列本地视觉和浏览路径。没有生产发布、真实订阅购买、真实激活码兑换或邮件发送。
