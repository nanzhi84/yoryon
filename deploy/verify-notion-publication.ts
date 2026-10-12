/** Reproducible source/media/browser acceptance for the three requested public posts. */
import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';
import { createRequire } from 'node:module';
import { parseMarkdown, rewriteMediaRefs } from '../packages/core/src/markdown';
import { stringifyMarkdown } from '../packages/core/src/preview';
const require=createRequire(new URL('../e2e/package.json',import.meta.url));
const {chromium,expect}=require('@playwright/test');
const root=new URL('../artifacts/notion-publication-20261012/',import.meta.url);
const manifest=JSON.parse(await fs.readFile(new URL('manifest.json',root),'utf8'));
const report={target:'https://yoryon.com',startedAt:new Date().toISOString(),checks:[] as {name:string;status:string}[],articles:[] as unknown[]};
function check(name:string,ok:boolean){report.checks.push({name,status:ok?'PASS':'FAIL'});if(!ok)throw Error(name);}
const hash=(data:Buffer|string)=>crypto.createHash('sha256').update(data).digest('hex');
const browser=await chromium.launch();
try {
 for(const post of manifest){
  const url=`https://yoryon.com/p/${post.slug}`;
  const response=await fetch(`https://api.yoryon.com/api/public/contents/${post.slug}`,{signal:AbortSignal.timeout(20000)});
  check(`${post.slug}: anonymous API`,response.status===200); const data=await response.json() as any;
  check(`${post.slug}: free full`,data.visibility==='public'&&data.access==='full');
  check(`${post.slug}: writing date`,data.publishedAt===new Date(`${post.date}T00:00:00+08:00`).toISOString());
  const source=await fs.readFile(new URL(`posts/${post.slug}/index.md`,root),'utf8');
  check(`${post.slug}: exact title`,source.includes(`title: "${data.title}"`)||source.includes(`title: ${data.title}`));
  const body=source.replace(/^---\r?\n[\s\S]*?\r?\n---\r?\n/,'');const mapping=new Map<string,string>();
  check(`${post.slug}: media count`,data.media.length===post.images.length);
  for(const media of data.media){
   const res=await fetch(`https://yoryon.com/api/media/${media.mediaId}`,{signal:AbortSignal.timeout(20000)});
   check(`${post.slug}: image byte read`,res.status===200);const bytes=Buffer.from(await res.arrayBuffer());const sha=hash(bytes); const original=post.images.find((img:any)=>img.sha256===sha);
   check(`${post.slug}: original image SHA256`,Boolean(original));mapping.set(`./media/${original.file}`,media.mediaId);
  }
  const expected=stringifyMarkdown(rewriteMediaRefs(parseMarkdown(body),mapping));
  check(`${post.slug}: complete canonical Markdown`,expected===data.bodyMarkdown);
  for(const mobile of [false,true]){
   const context=await browser.newContext({viewport:mobile?{width:390,height:844}:{width:1280,height:900}});const page=await context.newPage();let privateCalls=0;const errors:string[]=[];
   page.on('request',(req:any)=>{if(new URL(req.url()).pathname===`/api/contents/${post.slug}`)privateCalls++;});page.on('pageerror',()=>errors.push('browser error'));
   await page.goto(url,{waitUntil:'networkidle',timeout:30000});await expect(page.getByRole('heading',{level:1,name:data.title,exact:true})).toBeVisible();
   await expect(page.locator('main time')).toContainText(new Date(`${post.date}T00:00:00+08:00`).toLocaleDateString('zh-CN',{year:'numeric',month:'long',day:'numeric',timeZone:'Asia/Singapore'}));
   const imgs=page.locator('main img');check(`${post.slug}: rendered images`,await imgs.count()===post.images.length);
   for(let i=0;i<await imgs.count();i++){await imgs.nth(i).scrollIntoViewIfNeeded();await expect.poll(()=>imgs.nth(i).evaluate((img:HTMLImageElement)=>img.complete&&img.naturalWidth>0)).toBe(true);}
   check(`${post.slug}: ${mobile?'mobile':'desktop'} layout`,await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
   check(`${post.slug}: no private full fetch`,privateCalls===0);check(`${post.slug}: browser errors`,errors.length===0);
   await page.evaluate(()=>scrollTo(0,0));await page.screenshot({path:path.join(root.pathname,`${post.slug}-${mobile?'mobile':'desktop'}.png`),fullPage:true});await context.close();
  }
  const pageRes=await fetch(url,{signal:AbortSignal.timeout(20000)});const html=await pageRes.text();
  check(`${post.slug}: static SEO`,html.includes('application/ld+json')&&html.includes(url));
  check(`${post.slug}: no persisted signed URL`,!html.includes('Signature=')&&!html.includes('Expires='));
  report.articles.push({slug:post.slug,title:data.title,publishedAt:data.publishedAt,revision:data.revision,bodySha256:hash(data.bodyMarkdown),images:data.media.length,cache:pageRes.headers.get('x-vercel-cache'),url});
 }
 const feed=await(await fetch('https://api.yoryon.com/api/feed')).json() as any;
 const actual=feed.items.filter((item:any)=>manifest.some((p:any)=>p.slug===item.slug)).map((item:any)=>item.slug);
 check('feed newest writing date first',JSON.stringify(actual)===JSON.stringify([...manifest].reverse().map(p=>p.slug)));
 const sitemap=await(await fetch('https://yoryon.com/sitemap.xml')).text();check('sitemap all three',manifest.every((p:any)=>sitemap.includes(`/p/${p.slug}`)));
} catch(error){(report as any).error=String(error);process.exitCode=1;}
finally {await browser.close();await fs.writeFile(new URL('acceptance.json',root),JSON.stringify({...report,finishedAt:new Date().toISOString()},null,2));console.log(JSON.stringify(report));}
