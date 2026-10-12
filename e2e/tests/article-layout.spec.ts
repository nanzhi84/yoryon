import {test,expect} from '@playwright/test';
import {createPost} from '../helpers/fixtures';
import {runCliOk} from '../helpers/cli';
import {runId} from '../helpers/env';

// Long links must wrap within mobile prose; code keeps whitespace and scrolls locally.
test('文章长链接不撑宽手机页面，代码保留缩进并局部滚动',async({page},info)=>{
 const slug=`article-layout-${runId()}`;
 const link='https://deepseek.csdn.net/6a7f254310ee7a33f29b0548.html';
 const code='  '+ 'UNBROKEN_CODE_TOKEN_'.repeat(30);
 await runCliOk(['publish',await createPost({slug,body:`参考资料：[${link}](${link})\n\n\`\`\`text\n${code}\n\`\`\``})]);
 for(const width of [390,1280]){
  await page.setViewportSize({width,height:844});await page.goto(`/p/${slug}`);
  await expect(page.locator('main a').filter({hasText:link})).toHaveAttribute('href',link);
  expect(await page.locator('pre code').textContent()).toBe(code+'\n');
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
  expect(await page.locator('pre').evaluate(el=>el.scrollWidth>el.clientWidth)).toBe(true);
 }
 await info.attach('article layout contract',{body:JSON.stringify({environment:'isolated PG/FS, next start, TTL86400',command:'pnpm --dir e2e exec playwright test tests/article-layout.spec.ts',assertions:['390px and 1280px page fits viewport','exact original link href','code indentation unchanged','long code scroll contained within pre']}),contentType:'application/json'});
});
