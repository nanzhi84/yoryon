/** Live API acceptance. Creates uniquely named synthetic data and cleans only that data.
 * Run: node deploy/verify-production.mjs [https://api.yoryon.com|https://yoryon.com] [--browser]
 * Requires local protected credentials, SSH access, and deployed production containers.
 * SMTP delivery is deliberately reported separately, never simulated as a production pass.
 */
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
import { createRequire } from 'node:module';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

const exec = promisify(execFile);
const require = createRequire(new URL('../packages/core/package.json', import.meta.url));
const { Client } = require('pg');
const argon2 = require('argon2');
const base = process.argv[2] ?? 'https://api.yoryon.com';
if (!['https://api.yoryon.com', 'https://yoryon.com'].includes(base)) throw Error('Unexpected target');
const viaBff = base === 'https://yoryon.com';
const withBrowser = process.argv.includes('--browser');
if (withBrowser && !viaBff) throw Error('Browser acceptance requires the production frontend');
const artifactDir = new URL('../artifacts/production-20261012/', import.meta.url);
await fs.mkdir(artifactDir, { recursive: true });
const credentials = JSON.parse(await fs.readFile(path.join(os.homedir(), '.config/yoryon-production/secrets.json')));
const run = `acceptance-${Date.now()}-${crypto.randomBytes(3).toString('hex')}`;
const root = await fs.mkdtemp(path.join(os.tmpdir(), 'yoryon-acceptance-'));
const postRoot = path.join(root, run);
const slugs = { public: `${run}-public`, paid: `${run}-paid` };
const email = `${run}@example.invalid`;
const username = `qa${crypto.randomBytes(6).toString('hex')}`;
const password = crypto.randomBytes(24).toString('base64url');
const db = new Client({ connectionString: credentials.database_cli_url });
const checks = [];
let userId, code, token, cookie, browser, media = [];
const shell = value => `'${value.replaceAll("'", "'\\''")}'`;
const ssh = command => exec('ssh', ['-o', 'BatchMode=yes', 'admin@8.222.152.17', command], { timeout: 60000, maxBuffer: 1024 * 1024 });
const cli = async (...args) => (await ssh(`cd /opt/yoryon && sudo docker compose -f compose.neon.yml run --rm cli ${args.map(shell).join(' ')}`)).stdout;
function check(name, ok) {
  checks.push({ name, status: ok ? 'PASS' : 'FAIL' });
  if (!ok) throw Error(`Assertion failed: ${name}`);
}
async function request(route, body, authenticated = false, extraHeaders = {}) {
  const headers = { 'content-type': 'application/json', ...extraHeaders };
  if (body !== undefined && viaBff) headers.origin = base;
  if (authenticated) {
    if (viaBff) headers.cookie = cookie;
    else headers.authorization = `Bearer ${token}`;
  }
  const response = await fetch(base + route, {
    method: body === undefined ? 'GET' : 'POST', redirect: 'manual', headers,
    body: body === undefined ? undefined : JSON.stringify(body), signal: AbortSignal.timeout(20000),
  });
  const text = await response.text();
  let json;
  try { json = JSON.parse(text); } catch { /* Some routes are redirects. */ }
  return { status: response.status, headers: response.headers, json, text };
}
async function makePost(kind, visibility, suffix = '') {
  const dir = path.join(postRoot, kind);
  await fs.mkdir(path.join(dir, 'media'), { recursive: true });
  await fs.writeFile(path.join(dir, 'media/test.svg'), `<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20"><title>${run}-${kind}</title><rect width="20" height="20" fill="blue"/></svg>`);
  await fs.writeFile(path.join(dir, 'index.md'), `---\ntitle: "部署验收临时内容 ${kind}"\nslug: ${slugs[kind]}\ntype: article\nvisibility: ${visibility}\npreview: { mode: none }\n---\n\nBODY-${run}-${kind}${suffix}\n\n![验收图片](./media/test.svg)\n`);
}
async function uploadPosts() {
  await exec('scp', ['-r', postRoot, 'admin@8.222.152.17:/opt/yoryon/posts/'], { timeout: 60000 });
}
const report = { startedAt: new Date().toISOString(), target: base, run, checks, smtp: 'UNVERIFIED', staticArticleIssue6: 'NOT_IMPLEMENTED' };
try {
  await db.connect();
  await makePost('public', 'public');
  await makePost('paid', 'paid');
  await uploadPosts();
  await cli('publish', `/posts/${run}`);
  check('server_cli_publish_two_articles', (await db.query('select count(*)::int as n from contents where slug=any($1)', [Object.values(slugs)])).rows[0].n === 2);
  media = (await db.query('select m.id, m.oss_key, c.slug from media_assets m join content_media cm on cm.media_id=m.id join contents c on c.id=cm.content_id where c.slug=any($1)', [Object.values(slugs)])).rows;
  const freeMedia = media.find(m => m.slug === slugs.public);
  const paidMedia = media.find(m => m.slug === slugs.paid);
  const publicResult = await request(`/api/contents/${slugs.public}`);
  check('anonymous_public_full_body', publicResult.status === 200 && publicResult.json.access === 'full' && publicResult.text.includes(`BODY-${run}-public`));
  const paidResult = await request(`/api/contents/${slugs.paid}`);
  check('anonymous_paid_body_hidden', paidResult.status === 200 && paidResult.json.access === 'preview' && !paidResult.text.includes(`BODY-${run}-paid`));
  check('anonymous_paid_media_denied', (await request(`/api/media/${paidMedia.id}`)).status === 403);
  const signed = await request(`/api/media/${freeMedia.id}`);
  check('public_media_redirect_rechecks_authorization', signed.status === 302 && signed.headers.get('cache-control').includes('no-store'));
  const url = new URL(signed.headers.get('location'));
  check('signed_media_https_origin', url.origin === 'https://api.yoryon.com');
  const bytes = await fetch(url, { headers: { range: 'bytes=0-9' }, signal: AbortSignal.timeout(20000) });
  check('signed_media_range_206', bytes.status === 206 && (await bytes.arrayBuffer()).byteLength === 10);
  url.searchParams.set('sig', '0'.repeat(64));
  const forged = await fetch(url, { signal: AbortSignal.timeout(20000) });
  check('forged_media_signature_rejected', forged.status === 403); await forged.arrayBuffer();
  userId = (await db.query("insert into users(email,username,password_hash,status) values($1,$2,$3,'active') returning id", [email, username, await argon2.hash(password)])).rows[0].id;
  const login = await request('/api/auth/login', { emailOrUsername: email, password });
  check('active_fixture_user_login', login.status === 200);
  if (viaBff) {
    cookie = login.headers.get('set-cookie')?.split(';')[0];
    check('bff_secure_httponly_cookie', !!cookie && /httponly/i.test(login.headers.get('set-cookie')) && /secure/i.test(login.headers.get('set-cookie')) && !login.json.token);
  } else token = login.json.token;
  check('login_session_reads_current_user', (await request('/api/auth/me', undefined, true)).json.user.id === userId);
  const output = await cli('code', 'create', '--grant-type', 'content', '--content', slugs.paid, '--count', '1', '--note', run);
  code = output.match(/[A-Z2-9]{4}(?:-[A-Z2-9]{4}){3}/)?.[0];
  if (!code) throw Error('Activation code fixture was not created');
  if (withBrowser) {
    const { startBrowserAcceptance } = await import('./verify-production-browser.mjs');
    browser = await startBrowserAcceptance({ base, slugs, run, email, password, username, check, artifactDir: artifactDir.pathname });
    report.browser = 'Chromium desktop and mobile viewport; fresh contexts; no storage state or traces';
  }
  const redemption = browser ? await browser.redeem(code) : await request('/api/redemptions', { code }, true);
  check('activation_code_redeems', redemption.status === 200 && !redemption.json.idempotent);
  check('redemption_replay_idempotent', (await request('/api/redemptions', { code }, true)).json.idempotent === true);
  const unlocked = await request(`/api/contents/${slugs.paid}`, undefined, true);
  check('entitled_paid_body_readable_private', unlocked.json.access === 'full' && unlocked.text.includes(`BODY-${run}-paid`) && unlocked.headers.get('cache-control').includes('no-store'));
  const unlockedMedia = await request(`/api/media/${paidMedia.id}`, undefined, true);
  check('entitled_media_private_redirect', unlockedMedia.status === 302 && unlockedMedia.headers.get('cache-control').includes('no-store'));
  check('authenticated_read_does_not_leak_to_guest', !(await request(`/api/contents/${slugs.paid}`)).text.includes(`BODY-${run}-paid`));
  await browser?.unlocked();
  await cli('entitlement', 'revoke', redemption.json.entitlement.id, '--reason', run);
  check('revoked_entitlement_loses_body', (await request(`/api/contents/${slugs.paid}`, undefined, true)).json.access === 'preview');
  check('revoked_entitlement_loses_media', (await request(`/api/media/${paidMedia.id}`, undefined, true)).status === 403);
  await browser?.revoked();
  await makePost('public', 'public', '-UPDATED'); await uploadPosts(); await cli('publish', `/posts/${run}/public`);
  check('published_edit_visible', (await request(`/api/contents/${slugs.public}`)).text.includes(`BODY-${run}-public-UPDATED`));
  await browser?.edited();
  await makePost('public', 'paid', '-UPDATED'); await uploadPosts(); await cli('publish', `/posts/${run}/public`);
  check('public_to_paid_hides_body', !(await request(`/api/contents/${slugs.public}`)).text.includes(`BODY-${run}-public`));
  const convertedMedia = await request(`/api/media/${freeMedia.id}`);
  report.convertedMedia = { status: convertedMedia.status, cacheControl: convertedMedia.headers.get('cache-control'), vercelCache: convertedMedia.headers.get('x-vercel-cache') };
  check('public_to_paid_stops_new_media_signatures', convertedMedia.status === 403);
  await browser?.converted();
  await cli('unpublish', slugs.public);
  check('unpublished_content_returns_404', (await request(`/api/contents/${slugs.public}`)).status === 404);
  await browser?.unpublished();
  await request('/api/auth/logout', {}, true);
  check('logout_invalidates_session', (await request('/api/auth/me', undefined, true)).status === 401);
  await browser?.finish();
  report.status = 'PASS';
} catch (error) {
  report.status = 'FAIL';
  // Never serialize command output, cookies, passwords, tokens, or signed URLs.
  report.error = error.message.startsWith('Assertion failed:') ? error.message : `${error.name}: execution failed; inspect protected process state`;
  if (browser) {
    // Browser assertion diagnostics only; scrub fixture and infrastructure secrets before saving.
    let diagnostic = error.message;
    for (const value of [...Object.values(credentials), password, token, cookie, code, email].filter(v => typeof v === 'string' && v.length > 0)) diagnostic = diagnostic.replaceAll(value, '[REDACTED]');
    report.browserDiagnostic = diagnostic.replace(/https?:\/\/[^\s"']+\?[^\s"']*/g, '[URL with query omitted]').slice(0, 1200);
  }
  process.exitCode = 1;
} finally {
  await browser?.close().catch(() => {});
  try {
    await db.query('begin');
    media = (await db.query('select m.id, m.oss_key from media_assets m join content_media cm on cm.media_id=m.id join contents c on c.id=cm.content_id where c.slug=any($1)', [Object.values(slugs)])).rows;
    if (userId) {
      await db.query('delete from entitlements where user_id=$1', [userId]);
      await db.query('delete from redemptions where user_id=$1', [userId]);
      await db.query('delete from sessions where user_id=$1', [userId]);
      await db.query('delete from users where id=$1 and email=$2', [userId, email]);
    }
    await db.query('delete from activation_codes where note=$1', [run]);
    await db.query('delete from analytics_events where target_id in (select id from contents where slug=any($1))', [Object.values(slugs)]);
    await db.query('delete from contents where slug=any($1)', [Object.values(slugs)]);
    for (const m of media) {
      if (!/^media\/[a-f0-9]{64}\.svg$/.test(m.oss_key)) throw Error('Unexpected fixture key');
      const deleted = await db.query('delete from media_assets where id=$1 and not exists(select 1 from content_media where media_id=$1) returning id', [m.id]);
      if (deleted.rowCount) await ssh(`rm -f -- ${shell(`/var/lib/yoryon/media/${m.oss_key}`)}`);
    }
    await db.query('commit');
    await ssh(`rm -rf -- ${shell(`/opt/yoryon/posts/${run}`)}`);
    check('synthetic_data_cleanup', (await db.query('select count(*)::int as n from contents where slug=any($1)', [Object.values(slugs)])).rows[0].n === 0);
  } catch { report.cleanup = 'FAIL'; report.status = 'FAIL'; process.exitCode = 1; await db.query('rollback').catch(() => {}); }
  await db.end();
  await fs.rm(root, { recursive: true, force: true });
  report.finishedAt = new Date().toISOString();
  await fs.writeFile(new URL(viaBff ? 'production-bff-acceptance.json' : 'production-api-acceptance.json', artifactDir), JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report, null, 2));
}
