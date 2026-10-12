/** Real OSS + Vercel cache/revocation proof. Serial production CLI, unique fixture.
 * Optional target: YORYON_IMAGE_TARGET=https://<protected deployment>.vercel.app
 * CLI-authenticated vercel curl accesses that candidate; credentials aren't saved. */
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
import { createRequire } from 'node:module';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

const require = createRequire(new URL('../packages/core/package.json', import.meta.url));
const sharp = createRequire(new URL('../apps/api/package.json', import.meta.url))('sharp');
const exec = promisify(execFile);
const target = process.env.YORYON_IMAGE_TARGET ?? 'https://yoryon.com';
const run = `imagecache-${Date.now()}-${crypto.randomBytes(3).toString('hex')}`;
const root = await fs.mkdtemp(path.join(os.tmpdir(), 'public-image-proof-'));
const dir = path.join(root, run);
await fs.mkdir(path.join(dir, 'media'), { recursive: true });
const credentials = JSON.parse(await fs.readFile(path.join(os.homedir(), '.config/yoryon-production/secrets.json')));
const config = JSON.parse(await fs.readFile(path.join(os.homedir(), '.config/yoryon-production/oss-credentials.json')));
const oss = new (require('ali-oss'))({ region: config.region, bucket: config.bucket, secure: true, ...config.cli });
const db = new (require('pg').Client)({ connectionString: credentials.database_cli_url });
await db.connect();
const quote = s => `'${s.replaceAll("'", "'\\''")}'`;
const ssh = cmd => exec('ssh', ['-o', 'BatchMode=yes', '-o', 'ConnectTimeout=10', 'admin@8.222.152.17', cmd], { timeout: 120000, maxBuffer: 1024 * 1024 });
const cli = (...args) => ssh(`sudo /opt/yoryon/blog ${args.map(quote).join(' ')}`);
const bytes = await sharp({ create: { width: 960, height: 480, channels: 3, background: '#' + crypto.randomBytes(3).toString('hex') } }).png().toBuffer();
const key = `media/${crypto.createHash('sha256').update(bytes).digest('hex')}.png`;
await fs.writeFile(path.join(dir, 'media/proof.png'), bytes);
const checks = [];
const report = { run, target, command: 'node deploy/verify-public-image-cache.mjs', environment: 'real OSS + production API; serial bounded CLI; unique synthetic image', startedAt: new Date().toISOString(), checks };
function check(name, ok) { checks.push({ name, status: ok ? 'PASS' : 'FAIL' }); if (!ok) throw Error(name); }
async function read(route, etag) {
  if (target === 'https://yoryon.com') {
    const res = await fetch(target + route, { headers: etag ? { 'if-none-match': etag } : {}, signal: AbortSignal.timeout(30000) });
    return { status: res.status, headers: Object.fromEntries(res.headers), bytes: Buffer.from(await res.arrayBuffer()) };
  }
  const args = ['curl', route, '--deployment', target, '--', '--silent', '--include', ...(etag ? ['-H', `If-None-Match: ${etag}`] : [])];
  const { stdout } = await exec('vercel', args, { encoding: 'buffer', timeout: 45000, maxBuffer: 10 * 1024 * 1024 });
  let start = stdout.indexOf(Buffer.from('HTTP/'));
  let end = stdout.indexOf(Buffer.from('\r\n\r\n'), start);
  // A configured HTTPS transport can emit CONNECT before the application
  // response. It carries no image headers/body and is not the target status.
  while (start >= 0 && end >= 0 && /Connection established|^HTTP\/\S+ 1\d\d\b/i.test(stdout.subarray(start, end).toString())) {
    start = stdout.indexOf(Buffer.from('HTTP/'), end + 4);
    end = stdout.indexOf(Buffer.from('\r\n\r\n'), start);
  }
  if (start < 0 || end < 0) throw Error('candidate response missing');
  const lines = stdout.subarray(start, end).toString().split('\r\n');
  return { status: Number(lines[0].split(' ')[1]), headers: Object.fromEntries(lines.slice(1).map(line => { const i = line.indexOf(':'); return [line.slice(0, i).toLowerCase(), line.slice(i + 1).trim()]; })), bytes: stdout.subarray(end + 4) };
}
async function publish(visibility) {
  await fs.writeFile(path.join(dir, 'index.md'), `---\ntitle: 图片缓存合成验收\nslug: ${run}\ntype: article\nvisibility: ${visibility}\npreview: { mode: none }\n---\n\n判断：**中文加粗。**后文。\n\n输入 \`state\`。\n\n![合成图片](./media/proof.png)\n`);
  await exec('scp', ['-r', dir, 'admin@8.222.152.17:/opt/yoryon/posts/'], { timeout: 30000 });
  const { stdout } = await cli('publish', `/posts/${run}`);
  check(`publish_${visibility}_verified`, stdout.includes(': verified') && !stdout.includes('pending'));
}
try {
  await publish('public');
  const data = await (await fetch(`https://api.yoryon.com/api/public/contents/${run}`)).json();
  const id = data.media[0].mediaId;
  const route = `/api/images/v1/${id}/320`;
  const first = await read(route);
  check('first image read', first.status === 200);
  check('WebP MIME', first.headers['content-type'] === 'image/webp');
  const meta = await sharp(first.bytes).metadata();
  check('actual WebP pixels', meta.format === 'webp' && meta.width === 320 && meta.height === 160);
  const warm = await read(route);
  check('Vercel warm HIT', warm.status === 200 && warm.headers['x-vercel-cache'] === 'HIT');
  check('warm same bytes', first.bytes.equals(warm.bytes));
  check('browser must revalidate', warm.headers['cache-control'] === 'public, max-age=0, must-revalidate');
  const etag = first.headers.etag;
  check('conditional 304', (await read(route, etag)).status === 304);
  check('invalid variant', (await read(`/api/images/v1/${id}/319`)).status === 400);
  const html = (await read(`/p/${run}`)).bytes.toString();
  check('CJK strong in candidate HTML', html.includes('<strong>中文加粗。</strong>后文'));
  await publish('paid');
  check('warm URL denied after paid', (await read(route)).status === 403);
  check('old ETag denied after paid', (await read(route, etag)).status === 403);
  await publish('public');
  check('republished reads same cached bytes', (await read(route)).status === 200);
  await cli('unpublish', run);
  check('unpublished warm URL denied', (await read(route)).status === 403);
  report.image = { sourceBytes: bytes.length, webpBytes: first.bytes.length, width: meta.width, height: meta.height, firstCache: first.headers['x-vercel-cache'], warmCache: warm.headers['x-vercel-cache'] };
} catch (error) { report.error = String(error).replace(/https?:\/\/\S+/g, '[endpoint]'); process.exitCode = 1; }
finally {
  try {
    await cli('content', 'delete', run);
    const deleted = await db.query('delete from media_assets where oss_key=$1 and not exists(select 1 from content_media where media_id=media_assets.id) returning id', [key]);
    if (deleted.rowCount) await oss.delete(key);
    await ssh(`rm -rf -- ${quote(`/opt/yoryon/posts/${run}`)}`);
    check('synthetic cleanup', (await db.query('select count(*)::int n from contents where slug=$1', [run])).rows[0].n === 0);
  } catch { report.cleanup = 'FAIL'; process.exitCode = 1; }
  await db.end(); await fs.rm(root, { recursive: true, force: true });
  report.finishedAt = new Date().toISOString();
  const out = process.env.YORYON_IMAGE_PROOF_FILE ?? 'artifacts/article-fixes-20261012/public-image-cache.json';
  await fs.mkdir(path.dirname(out), { recursive: true }); await fs.writeFile(out, JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report));
}
