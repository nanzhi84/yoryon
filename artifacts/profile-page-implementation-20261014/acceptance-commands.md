# 现场验收命令与复验路径

执行目录 `/Users/yoryon/Projects/yoryon`，版本 `b8e7098e941f80d899cd6483a9ce236732e5ddf6` 加本次本地未提交资料页改动。隔离 API 必须是4115、隔离库必须是 `yoryon_page_redesign_20261013`，Web3015使用 `/tmp/yoryon-page-redesign-m0NxxV/preview.env`。不输出环境文件。用户localhost已登录，所以本子agent使用 `http://127.0.0.1:3015` 自己的内置 Browser tab。原用户已有tab和Cookie不参与验收。每次复验现场选路径，不保存可执行套件或fixture。

## 实际账号准备

实际在 `apps/cli` 用如下启动方式执行一次stdin账号准备（数据库写入仅限明确隔离库，使用已有hashPassword）：

```sh
node --env-file=/tmp/yoryon-page-redesign-m0NxxV/preview.env --import tsx --input-type=module <<'JS'
import pg from 'pg';
import {randomBytes} from 'node:crypto';
import fs from 'node:fs/promises';
import {hashPassword} from '../../packages/core/src/auth.ts';
const client=new pg.Client({connectionString:process.env.DATABASE_URL});
await client.connect();
try {
  const db=(await client.query('select current_database() as name')).rows[0].name;
  if(db!=='yoryon_page_redesign_20261013') throw new Error('Isolation guard failed');
  const username='profile_check_'+randomBytes(4).toString('hex');
  const password='Local!'+randomBytes(18).toString('base64url');
  const passwordHash=await hashPassword(password);
  const assets=(await client.query('select id,oss_key from media_assets')).rows;
  const user=(await client.query("insert into users (email,username,password_hash,role,status,display_name) values ($1,$2,$3,'user','active',$4) returning id,username,role,status",[username+'@example.test',username,passwordHash,'资料验收用户'])).rows[0];
  const privatePath='/tmp/yoryon-page-redesign-m0NxxV/profile-acceptance-user.json';
  await fs.writeFile(privatePath,JSON.stringify({id:user.id,username,password,assetBaseline:assets}),{mode:0o600});
  await fs.chmod(privatePath,0o600);
  console.log(JSON.stringify({id:user.id,username:user.username,privatePath,baselineAssetCount:assets.length}));
} finally {await client.end();}
JS
```

原始provision回执：临时普通active用户 `profile_check_f13165ec`、媒体初始4项，见provision.json。未发送邮件、未创建会员权益。此处是一次性手工准备命令，未写成项目测试入口。凭据本轮已删除，复验需重新创建随机用户，不复用原用户名/固定密码或用户交付preview_test。

## 实际 Browser 操作

使用 `cua_repl` 创建自己的hidden IAB tab，查看该tab实际AX，再用当前页面可见标签定位，不借用原用户页面。主要实际调用如下（凭据变量不输出）：

```js
const tab = await cua.createBrowserTab('iab','http://127.0.0.1:3015/login?returnTo=%2Fsettings%2Fprofile',{visible:false});
const cdp = await tab.capabilities.get('cdp');
await cdp.send('Emulation.setDeviceMetricsOverride',{width:595,height:896,deviceScaleFactor:1,mobile:false});
const fs = await import('node:fs/promises');
const user = JSON.parse(await fs.readFile('/tmp/yoryon-page-redesign-m0NxxV/profile-acceptance-user.json','utf8'));
await tab.playwright.getByRole('textbox',{name:'邮箱或用户名'}).fill(user.username);
await tab.playwright.getByRole('textbox',{name:'密码',exact:true}).fill(user.password);
await tab.playwright.getByRole('button',{name:'登录',exact:true}).click();
await tab.getAXState();
```

实际步骤：

1. 新Web PID61659发布后reload。观察标题、只读用户名、头像先于名称、同背景与细线；只读DOM计算font/尺寸/间距。
2. 表单名称填`🙂资料验收`，点保存、等可见status、刷新；观察名称与默认🙂字符。写layout-persistence.json。
3. 填`未保存的资料草稿`，点上传，真实filechooser依次选仓库package.json、仓库author-avatar.jpg。前者非法类型，后者实际2303380字节超2MB；观察可见错误和草稿不变。
4. 实际上传使用已经存在的隔离内容PNG：`/tmp/yoryon-page-redesign-m0NxxV/storage/media/10d123e87a510b7d8e25773aba9e616bec6d3d457a79efdfb36e591e1fc41697.png`。原文件640×360、2607字节，未更改也未生成fixture。上传流程为：

```js
const chooserPromise = tab.playwright.waitForEvent('filechooser',{timeoutMs:10000});
await tab.playwright.getByRole('button',{name:'上传头像',exact:true}).click();
const chooser = await chooserPromise;
await chooser.setFiles('/tmp/yoryon-page-redesign-m0NxxV/storage/media/10d123e87a510b7d8e25773aba9e616bec6d3d457a79efdfb36e591e1fc41697.png');
await tab.getAXState();
```

5. 观察上传中禁用、自动保存、未保存草稿不变。SQL取当前用户avatar id，GET实际BFF头像，sharp解码、对比FS字节（下一节）；再次更换相同文件，再点移除，草稿不变。
6. 输入41个`验`，点保存，观察API400与页面说明；纠正为`资料验收用户`保存。Network.responseReceived只摘录资料路径/status/mimeType，不保存Cookie/headers或认证响应体。
7. 仅自己tab设置 `Network.setBlockedURLs` 为 `*://127.0.0.1:3015/api/me/profile*`，点保存观察可见失败；解除为空数组后点保存恢复。再次阻断并reload，看到初始加载失败；解除后点重试恢复。没有遗留网络修改。初始GET流程曾遇到全页getByRole('alert')同时匹配Next route announcer，改用已观察到的`main [role="alert"]`定位，最终加载反馈正常。
8. 在上传按钮press Tab，activeElement是displayName；名称输入press Tab，activeElement是保存按钮。
9. 临时tab尺寸改568×896，reload取原始568截图与布局JSON；不修改姓名展示为用户账号，不做图片后期编辑。内置截图包装器会缩放595×335，最终用本tab原始CDP截图。

```js
await cdp.send('Emulation.setDeviceMetricsOverride',{width:568,height:896,deviceScaleFactor:1,mobile:false});
await tab.reload();
const shot=await cdp.send('Page.captureScreenshot',{format:'png',captureBeyondViewport:true,fromSurface:true,clip:{x:0,y:0,width:568,height:896,scale:1}});
await fs.writeFile('/Users/yoryon/Projects/yoryon/artifacts/profile-page-implementation-20261014/preview-profile-568.png',Buffer.from(shot.data,'base64'));
```

10. 实际账户菜单→退出登录，导航首页；再导航已知profile页，确认401与仅登录提示。解除network block、清除metrics override、关闭自己的tab。**本轮清理SID读取时机存在缺口：profile时SID为null，logout导航首页后未重读便关闭tab，所以统计清理UNVERIFIED。复验应在登出首页加载后、关闭tab之前再读取自身SID并0600暂存。**

## 实际媒体/SQL检查

`file /tmp/yoryon-page-redesign-m0NxxV/storage/media/*.png`回执：已有1×1及640×360两张PNG；选640×360用于真实上传。`stat -f '%z %N' apps/web/public/images/author-avatar.jpg`回执2303380。

在 `apps/api` 实际运行 `node --env-file=/tmp/yoryon-page-redesign-m0NxxV/preview.env --input-type=module` stdin，pg连接后先guard当前库；依据临时userid查询：

```sql
select id,username,display_name,avatar_media_id from users where id=$1;
select id,oss_key,mime_type,size_bytes,width,height from media_assets where id=$1;
```

通过Node fetch GET `http://127.0.0.1:3015/api/avatars/<实际avatar id>`，`sharp(bytes).metadata()`解码；FS读取 `/tmp/yoryon-page-redesign-m0NxxV/storage/<实际oss_key>`，`bytes.equals(stored)`与两个SHA256对比。实际回执：新asset `31690ac8-0795-4b62-9e11-c31283b9efbc`，320×320单页webp，1744字节，两个digest相同。response字节仅存avatar-response.webp，摘要avatar-bytes.json，不包含令牌或Cookie。

## 实际精确清理

在 `apps/cli` 用同一node env-file启动一次stdin清理，user UUID与`profile_check_<8hex>`严格guard、当前库严格guard；重复读事务取得 `yoryon.media_publish_gc` advisory lock（5秒lock_timeout），清理前该临时用户avatar=null、sessions=0，真实logout已撤销会话。

执行的删除语句范围：

```sql
delete from sessions where user_id=$1 returning id;
delete from users where id=$1 and username=$2 returning id;
-- avatar id来自本次上传receipt；必须不在初始assetBaseline，且下列四种ref总计0才删除
select (select count(*) from users where avatar_media_id=$1)
     + (select count(*) from contents where cover_media_id=$1)
     + (select count(*) from collections where cover_media_id=$1)
     + (select count(*) from content_media where media_id=$1) as count;
delete from media_assets where id=$1;
```

仅删除新头像`avatars/77760171946206075135d5123cd3fa874e22f57f45c9f2b3a2a6a525c46628e4.webp`，严格key/path guard；commit后fs.rm该明确文件并核验不存在。清理前后其他用户/会话、内容/合集/评论、权益/兑换/问答、全部统计数量一致，旧4项媒体仍存在。删除自己0600凭据文件。

首次清理因SID=null被owner guard拒绝，任何DELETE未执行。后续修正清理范围只包括可证实归属的用户、会话及头像；全部匿名统计保留，不按时间或最近SID推断删除。cleanup.json记录该限制与精确回执。

最终原始截图尺寸复核实际命令：

```sh
sips -g pixelWidth -g pixelHeight artifacts/profile-page-implementation-20261014/preview-profile-568.png
```

回执568×896。验收结论与未覆盖项见acceptance.md。
