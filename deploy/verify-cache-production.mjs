/** Synthetic live cache/performance acceptance. Never records cookies or signed URLs. */
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { createRequire } from 'node:module';
const exec = promisify(execFile);
const require = createRequire(new URL('../e2e/package.json', import.meta.url));
const { chromium, expect } = require('@playwright/test');
const phase = process.argv[2];
if (!['baseline','after','cleanup'].includes(phase)) throw Error('Use baseline|after|cleanup');
const base = 'https://yoryon.com';
const artifacts = new URL('../artifacts/performance-20261012/', import.meta.url);
await fs.mkdir(artifacts, { recursive: true });
const statePath = new URL('fixture.json', artifacts);
let state;
if (phase === 'baseline') {
  state = { run: `cacheproof-${Date.now()}-${crypto.randomBytes(3).toString('hex')}` };
  await fs.writeFile(statePath, JSON.stringify(state));
} else state = JSON.parse(await fs.readFile(statePath));
const slug = state.run;
const marker = `SYNTHETIC_FULL_${slug}`;
const shell = value => `'${value.replaceAll("'", "'\\''")}'`;
const ssh = command => exec('ssh', ['-o','BatchMode=yes','admin@8.222.152.17',command], { timeout:120000, maxBuffer:4*1024*1024 });
const cli = async (...args) => (await ssh(`cd /opt/yoryon && sudo /opt/yoryon/blog ${args.map(shell).join(' ')}`)).stdout;
const request = async (route, headers={}) => {
  const start = performance.now();
  const res = await fetch(base+route, { headers, redirect:'manual',signal:AbortSignal.timeout(20000) });
  const text = await res.text();
  return { status:res.status,text,ms:performance.now()-start,headers:Object.fromEntries(['x-vercel-cache','x-nextjs-cache','cache-control','x-vercel-id'].map(h=>[h,res.headers.get(h)])) };
};
const checks=[];
function check(name,ok) { checks.push({name,status:ok?'PASS':'FAIL'}); if(!ok) throw Error(`Assertion failed: ${name}`); }
const root = await fs.mkdtemp(path.join(os.tmpdir(),'cacheproof-'));
async function publish(visibility='public',suffix='') {
  const dir=path.join(root,slug); await fs.mkdir(dir,{recursive:true});
  await fs.writeFile(path.join(dir,'index.md'),`---\ntitle: 缓存性能验收临时文章\nslug: ${slug}\ntype: article\nvisibility: ${visibility}\npreview: { mode: marker }\ntags: [cacheproof]\n---\n\n公开导言。\n\n<!-- more -->\n\n${marker}${suffix}\n\n${'这是相同的合成文章，用于比较正文缓存前后读取。\n\n'.repeat(100)}`);
  await exec('scp',['-r',dir,'admin@8.222.152.17:/opt/yoryon/posts/'],{timeout:60000});
  const started=Date.now(); const output=await cli('publish',`/posts/${slug}`);
  return {elapsedMs:Date.now()-started,verified:(output.match(/: verified/g)??[]).length,pending:output.includes('pending')};
}
async function bodyCalls() {
  const {stdout}=await ssh('sudo docker logs yoryon-api-1 --since 30m 2>/dev/null');
  const lines=stdout.split('\n').flatMap(line=>{try{return [JSON.parse(line)];}catch{return [];}});
  return {body:lines.filter(x=>x.path===`/api/public/contents/${slug}`||x.path===`/api/contents/${slug}`).length,policy:lines.filter(x=>x.path===`/api/public/policy/${slug}`).length};
}
const report={phase,run:slug,startedAt:new Date().toISOString(),target:base,checks};
let browser;
try {
  if(phase==='cleanup') {
    await cli('content','delete',slug);
    await ssh(`sudo rm -rf /opt/yoryon/posts/${slug}`);
    check('canonical_deleted',(await request(`/p/${slug}`)).status===404);
  } else {
    if(phase==='baseline') report.publish=await publish();
    else { report.refresh=await cli('cache','refresh',slug); check('refresh_verified',report.refresh.includes(': verified')&&!report.refresh.includes('pending')); }
    const metaRes=await fetch(`https://api.yoryon.com/api/contents/${slug}`);const meta=await metaRes.json();
    const oldRevision=meta.revision;
    const before=await bodyCalls();
    report.network=[];
    for(let i=0;i<5;i++) {
      const res=await request(`/p/${slug}`); check(`warm_read_${i}`,res.status===200&&res.text.includes(marker));
      report.network.push({status:res.status,ms:res.ms,headers:res.headers});
    }
    const after=await bodyCalls();report.apiDelta={body:after.body-before.body,policy:after.policy-before.policy};
    if(phase==='after')check('warm_reads_no_body_api',report.apiDelta.body===0);
    browser=await chromium.launch();
    report.browser=[];
    for(const mobile of [false,true]) {
      const context=await browser.newContext({viewport:mobile?{width:390,height:844}:{width:1280,height:900}});
      const page=await context.newPage();let privateCalls=0;
      page.on('request',r=>{if(new URL(r.url()).pathname===`/api/contents/${slug}`)privateCalls++;});
      await page.addInitScript(()=>{window.__perf={lcp:0,cls:0};new PerformanceObserver(l=>{for(const e of l.getEntries())window.__perf.lcp=e.startTime;}).observe({type:'largest-contentful-paint',buffered:true});new PerformanceObserver(l=>{for(const e of l.getEntries())if(!e.hadRecentInput)window.__perf.cls+=e.value;}).observe({type:'layout-shift',buffered:true});});
      await page.goto(`${base}/p/${slug}`,{waitUntil:'networkidle'});await expect(page.getByText(marker,{exact:true})).toBeVisible();
      const perf=await page.evaluate(()=>({ttfb:performance.getEntriesByType('navigation')[0].responseStart,lcp:window.__perf.lcp,cls:window.__perf.cls,overflow:document.documentElement.scrollWidth>innerWidth}));
      check(`${mobile?'mobile':'desktop'}_layout`,!perf.overflow);
      if(phase==='after')check(`${mobile?'mobile':'desktop'}_no_private_fetch`,privateCalls===0);
      report.browser.push({mobile,privateCalls,...perf});
      await page.screenshot({path:new URL(`${phase}-${mobile?'mobile':'desktop'}.png`,artifacts).pathname,fullPage:true});
      await context.close();
    }
    if(phase==='after') {
      report.edit=await publish('public','_EDIT');check('edit_verified_under_60s',report.edit.verified>0&&!report.edit.pending&&report.edit.elapsedMs<60000);
      check('edit_real_body',(await request(`/p/${slug}`)).text.includes(marker+'_EDIT'));
      report.convert=await publish('paid','_PAID');check('conversion_verified',report.convert.verified>0&&!report.convert.pending);
      for(const origin of [base,'https://www.yoryon.com']) {
        const res=await fetch(origin+`/p/${slug}`,{signal:AbortSignal.timeout(20000)});const text=await res.text();check(`alias_${new URL(origin).hostname}_no_full`,res.status===200&&!text.includes(marker));
      }
      const old=await request(`/render/${oldRevision}/${slug}`);check('old_render_blocked',old.status===404&&!old.text.includes(marker));
      const rsc=await request(`/p/${slug}?_rsc=proof`,{RSC:'1'});check('rsc_no_paid_body',!rsc.text.includes(marker));
      const json=await request(`/api/public/contents/${slug}`);check('public_json_no_paid_body',json.status===200&&!json.text.includes(marker));
      const out=await cli('unpublish',slug);check('unpublish_verified',out.includes(': verified')&&!out.includes('pending'));
      check('unpublish_canonical_404',(await request(`/p/${slug}`)).status===404);
      report.republish=await publish();check('republish_body',(await request(`/p/${slug}`)).text.includes(marker));
    }
  }
} catch(error) {report.error=String(error);process.exitCode=1;}
finally {await browser?.close();await fs.rm(root,{recursive:true,force:true});report.finishedAt=new Date().toISOString();await fs.writeFile(new URL(`${phase}-cache-proof.json`,artifacts),JSON.stringify(report,null,2));console.log(JSON.stringify({phase,checks,error:report.error,apiDelta:report.apiDelta,browser:report.browser}));}
