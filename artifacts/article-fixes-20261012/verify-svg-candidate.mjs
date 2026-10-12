import fs from 'node:fs/promises';
import crypto from 'node:crypto';
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
const exec = promisify(execFile);
const target = process.env.YORYON_SVG_TARGET;
if (!target) throw Error('YORYON_SVG_TARGET is required');
const checks = [];
const report = {target, command: 'YORYON_SVG_TARGET=<candidate> node artifacts/article-fixes-20261012/verify-svg-candidate.mjs', environment: 'real Jev source, OSS, compression-enabled production Caddy, CLI-authenticated candidate', checks, images: []};
const check = (name, ok) => {checks.push({name, status:ok?'PASS':'FAIL'}); if(!ok) throw Error(name);};
const hash = b => crypto.createHash('sha256').update(b).digest('hex');
const manifest = JSON.parse(await fs.readFile('artifacts/notion-publication-20261012/manifest.json'));
const expected = manifest.find(p=>p.slug==='jev-typed-decisions').images.map(i=>i.sha256);
async function read(route, tag) {
  const {stdout} = await exec('vercel',['curl',route,'--deployment',target,'--','--silent','--include','--compressed',...(tag?['-H',`If-None-Match: ${tag}`]:[])],{encoding:'buffer',timeout:45000,maxBuffer:2*1024*1024});
  let start=stdout.indexOf(Buffer.from('HTTP/')), end=stdout.indexOf(Buffer.from('\r\n\r\n'),start);
  while(start>=0&&end>=0&&/Connection established|^HTTP\/\S+ 1\d\d\b/i.test(stdout.subarray(start,end).toString())) {start=stdout.indexOf(Buffer.from('HTTP/'),end+4);end=stdout.indexOf(Buffer.from('\r\n\r\n'),start);}
  if(start<0||end<0) throw Error('candidate response missing');
  const lines=stdout.subarray(start,end).toString().split('\r\n');
  return {status:Number(lines[0].split(' ')[1]),headers:Object.fromEntries(lines.slice(1).map(l=>{const i=l.indexOf(':');return [l.slice(0,i).toLowerCase(),l.slice(i+1).trim()];})),bytes:stdout.subarray(end+4)};
}
try {
  const data = await (await fetch('https://api.yoryon.com/api/public/contents/jev-typed-decisions')).json();
  check('five SVG source assets', data.media.length===5 && data.media.every(m=>m.mimeType==='image/svg+xml'));
  for(const m of data.media) {
    const route=`/api/images/v1/${m.mediaId}/original`;
    const source=await fetch(`https://api.yoryon.com/api/public/images/${m.mediaId}/original`);
    const original=Buffer.from(await source.arrayBuffer());
    const sha=hash(original);
    check(`${m.mediaId}: source original SHA256`,source.status===200&&expected.includes(sha));
    const first=await read(route);
    check(`${m.mediaId}: candidate SVG 200`,first.status===200&&first.headers['content-type']==='image/svg+xml');
    check(`${m.mediaId}: original vector bytes`,first.bytes.equals(original));
    // Vercel weakens ETag when gzip is applied at the CDN; the identity value
    // must remain unchanged and its actual emitted tag must yield zero bytes.
    check(`${m.mediaId}: canonical ETag`,first.headers.etag?.replace(/^W\//,'')===`"image-v1-${sha}-original"`);
    const warm=await read(route);
    check(`${m.mediaId}: CDN HIT same bytes`,warm.status===200&&warm.headers['x-vercel-cache']==='HIT'&&warm.bytes.equals(original));
    const conditional=await read(route,first.headers.etag);
    check(`${m.mediaId}: 304 zero body`,conditional.status===304&&conditional.bytes.length===0);
    report.images.push({id:m.mediaId,sha256:sha,bytes:original.length,sourceEncoding:source.headers.get('content-encoding'),sourceETag:source.headers.get('etag'),candidateETag:first.headers.etag,warmCache:warm.headers['x-vercel-cache']});
  }
} catch(error){report.error=String(error);process.exitCode=1;}
report.finishedAt=new Date().toISOString();
await fs.writeFile('artifacts/article-fixes-20261012/svg-candidate.json',JSON.stringify(report,null,2));
console.log(JSON.stringify({checks:checks.length,failed:checks.filter(c=>c.status!=='PASS'),images:report.images.length,error:report.error}));
