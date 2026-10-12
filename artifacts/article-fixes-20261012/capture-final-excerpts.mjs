import {createRequire} from 'node:module';
const require=createRequire(new URL('../../e2e/package.json', import.meta.url));
const {chromium}=require('@playwright/test');
const browser=await chromium.launch();
try {
 const page=await browser.newPage({viewport:{width:1280,height:900}});
 await page.goto('https://yoryon.com/p/workflow-to-agent-patterns',{waitUntil:'networkidle'});
 await page.locator('.prose p').filter({hasText:'判断一个系统属于哪一类'}).screenshot({path:'artifacts/article-fixes-20261012/workflow-strong-final.png'});
 await page.goto('https://yoryon.com/p/jev-typed-decisions',{waitUntil:'networkidle'});
 await page.locator('.prose p').filter({hasText:'它把这一步组织成'}).screenshot({path:'artifacts/article-fixes-20261012/jev-inline-code-final.png'});
 const svg=page.locator('main img').first();
 await svg.scrollIntoViewIfNeeded();
 await svg.screenshot({path:'artifacts/article-fixes-20261012/jev-vector-final.png'});
} finally {await browser.close();}
