/** Real production registration/reset acceptance. No database-generated verification codes.
 * Run: node deploy/verify-production-mail.mjs --email <explicitly authorized recipient>
 * At AWAIT_MAIL, write verified Gmail metadata to <purpose>.receipt.json in the
 * protected configuration directory, then let the human fill mail-acceptance-codes.json.
 * Metadata: {run,purpose,sender,messageId,labelIds,authentication:{spf,dkim,dmarc},source:'gmail_connector'}
 * Receipt codes/passwords/cookies never enter artifacts. Only this run's account is removed.
 */
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
import { createRequire } from 'node:module';

const require = createRequire(new URL('../packages/core/package.json', import.meta.url));
const browserRequire = createRequire(new URL('../e2e/package.json', import.meta.url));
const { Client } = require('pg');
const { chromium, expect } = browserRequire('@playwright/test');
const email = process.argv[process.argv.indexOf('--email') + 1];
if (!process.argv.includes('--email') || !/^[^\s@]+@gmail\.com$/.test(email)) throw Error('Explicit Gmail recipient required');
const base = 'https://yoryon.com';
const sender = 'noreply@notify.yoryon.com';
const startedAt = new Date();
const run = `smtp-${Date.now()}-${crypto.randomBytes(4).toString('hex')}`;
const username = `smtpqa${crypto.randomBytes(6).toString('hex')}`;
const password = crypto.randomBytes(24).toString('base64url');
const newPassword = crypto.randomBytes(24).toString('base64url');
const credentials = JSON.parse(await fs.readFile(path.join(os.homedir(), '.config/yoryon-production/secrets.json')));
const db = new Client({ connectionString: credentials.database_cli_url });
const artifactRoot = new URL('../artifacts/directmail-20261012/', import.meta.url).pathname;
const artifactDir = path.join(artifactRoot, 'attempts', run);
await fs.mkdir(artifactDir, { recursive: true });
const handoffDir = path.join(os.homedir(), '.config/yoryon-production');
const codesPath = path.join(handoffDir, 'mail-acceptance-codes.json');
await fs.writeFile(codesPath, JSON.stringify({ run, register: '', password_reset: '' }) + '\n', { mode: 0o600 });
await fs.chmod(codesPath, 0o600);
const checks = [];
const report = { run, startedAt: startedAt.toISOString(), target: base, sender, recipient: 'explicitly_authorized_gmail',
  evidenceDirectory: path.relative(artifactRoot, artifactDir), checks, receipts: [] };
let browser, connected = false, registered = false;
function check(name, ok) {
  checks.push({ name, status: ok ? 'PASS' : 'FAIL' });
  if (!ok) throw Error(`Assertion failed: ${name}`);
}
async function receipt(purpose) {
  console.log(JSON.stringify({ status: 'AWAIT_MAIL', run, purpose, since: new Date().toISOString() }));
  const deadline = Date.now() + 480000;
  let value;
  while (Date.now() < deadline) {
    try {
      const metadataPath = path.join(handoffDir, `${purpose}.receipt.json`);
      for (const file of [codesPath, metadataPath]) {
        if ((await fs.stat(file)).mode & 0o077) throw Error('UNSAFE_HANDOFF_PERMISSIONS');
      }
      const codes = JSON.parse(await fs.readFile(codesPath, 'utf8'));
      const metadata = JSON.parse(await fs.readFile(metadataPath, 'utf8'));
      if (codes.run === run && metadata.run === run && metadata.purpose === purpose && /^\d{6}$/.test(codes[purpose] ?? '')) {
        value = { ...metadata, code: codes[purpose] };
        codes[purpose] = '';
        await fs.writeFile(codesPath, JSON.stringify(codes) + '\n', { mode: 0o600 });
        break;
      }
    } catch (error) {
      if (error.code !== 'ENOENT' && !(error instanceof SyntaxError)) throw error;
    }
    await new Promise(resolve => setTimeout(resolve, 1000));
  }
  if (!value) throw Error('REAL_MAIL_RECEIPT_TIMEOUT');
  const messageIdHash = /^[a-f0-9]{16,32}$/.test(value.messageId ?? '')
    ? crypto.createHash('sha256').update(value.messageId).digest('hex') : value.messageIdHash;
  check(`${purpose}_real_gmail_receipt`, value.source === 'gmail_connector' && /^[a-f0-9]{64}$/.test(messageIdHash ?? ''));
  check(`${purpose}_expected_sender`, value.sender === sender);
  check(`${purpose}_inbox_not_spam`, value.labelIds?.includes('INBOX') && !value.labelIds.includes('SPAM'));
  for (const kind of ['spf', 'dkim', 'dmarc']) check(`${purpose}_${kind}_pass`, value.authentication?.[kind] === true);
  check(`${purpose}_valid_code_shape`, /^\d{6}$/.test(value.code ?? ''));
  report.receipts.push({ purpose, messageIdHash, inbox: true, spf: 'PASS', dkim: 'PASS', dmarc: 'PASS', source: value.source });
  return value.code;
}
async function capture(page, name) {
  await page.screenshot({ path: path.join(artifactDir, name + '.png'), fullPage: true,
    mask: [page.locator('input'), page.locator('p').filter({ hasText: email })] });
}
const go = (page, route) => page.goto(base + route, { waitUntil: 'networkidle', timeout: 30000 });
try {
  await db.connect(); connected = true;
  check('recipient_has_no_existing_website_account', (await db.query('select count(*)::int as n from users where email=$1', [email])).rows[0].n === 0);
  browser = await chromium.launch();
  const member = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const page = await member.newPage();
  const browserErrors = [];
  page.on('pageerror', () => browserErrors.push('uncaught browser error'));
  page.setDefaultTimeout(20000);
  await go(page, '/register');
  await page.getByLabel('邮箱', { exact: true }).fill(email);
  await page.getByLabel('用户名', { exact: true }).fill(username);
  await page.getByLabel(/密码/).fill(password);
  const registrationResponse = page.waitForResponse(r => r.url() === base + '/api/auth/register' && r.request().method() === 'POST');
  await page.getByRole('button', { name: '注册', exact: true }).click();
  const registration = await registrationResponse;
  registered = true;
  check('production_registration_mail_request_succeeds', registration.status() === 200);
  await expect(page.getByLabel('验证码', { exact: true })).toBeVisible();
  check('registration_form_advances_to_email_verification', true);
  await capture(page, 'registration-awaiting-inbox');
  const registerCode = await receipt('register');
  const wrongCode = String((Number(registerCode) + 1) % 1000000).padStart(6, '0');
  await page.getByLabel('验证码', { exact: true }).fill(wrongCode);
  await page.getByRole('button', { name: '完成注册', exact: true }).click();
  await expect(page.locator('main').getByRole('alert')).toContainText('验证码错误');
  check('wrong_email_code_is_rejected', true);
  await page.getByLabel('验证码', { exact: true }).fill(registerCode);
  await page.getByRole('button', { name: '完成注册', exact: true }).click();
  await page.waitForURL(base + '/');
  const me = await page.request.get(base + '/api/auth/me');
  const user = (await me.json()).user;
  check('email_verification_activates_and_logs_in_user', me.status() === 200 && user?.email === email && user?.username === username);
  const session = (await member.cookies()).find(c => c.name === 'yoryon_session');
  check('verified_session_cookie_secure_httponly', !!session?.secure && !!session?.httpOnly && session.sameSite === 'Lax');
  const replay = await page.request.post(base + '/api/auth/verify-email', { data: { email, code: registerCode }, headers: { origin: base } });
  check('used_registration_code_cannot_be_replayed', replay.status() === 400);
  await capture(page, 'registration-completed');

  await go(page, '/reset-password');
  await page.getByLabel('注册邮箱', { exact: true }).fill(email);
  const resetResponse = page.waitForResponse(r => r.url() === base + '/api/auth/password-reset' && r.request().method() === 'POST');
  await page.getByRole('button', { name: '发送验证码', exact: true }).click();
  check('production_reset_mail_request_succeeds', (await resetResponse).status() === 200);
  await expect(page.getByLabel('验证码', { exact: true })).toBeVisible();
  check('reset_form_advances_to_email_verification', true);
  await capture(page, 'reset-awaiting-inbox');
  const resetCode = await receipt('password_reset');
  await page.getByLabel('验证码', { exact: true }).fill(resetCode);
  await page.getByLabel(/新密码/).fill(newPassword);
  await page.getByRole('button', { name: '重置密码', exact: true }).click();
  await page.waitForURL(base + '/login');
  check('reset_form_returns_to_login', true);
  check('password_reset_revokes_existing_session', (await page.request.get(base + '/api/auth/me')).status() === 401);
  const oldLogin = await page.request.post(base + '/api/auth/login', { data: { emailOrUsername: email, password }, headers: { origin: base } });
  check('old_password_cannot_login_after_reset', oldLogin.status() === 401);
  const repeatedReset = await page.request.post(base + '/api/auth/password-reset', { data: { email, code: resetCode, newPassword }, headers: { origin: base } });
  check('used_reset_code_cannot_be_replayed', repeatedReset.status() === 400);
  await page.getByLabel('邮箱或用户名', { exact: true }).fill(email);
  await page.getByLabel('密码', { exact: true }).fill(newPassword);
  await page.getByRole('button', { name: '登录', exact: true }).click();
  await page.waitForURL(base + '/');
  check('new_password_login_succeeds', (await page.request.get(base + '/api/auth/me')).status() === 200);
  await capture(page, 'new-password-login-completed');
  await page.request.post(base + '/api/auth/logout', { data: {}, headers: { origin: base } });
  check('logout_invalidates_new_session', (await page.request.get(base + '/api/auth/me')).status() === 401);
  check('no_uncaught_browser_errors', browserErrors.length === 0);
  report.status = 'PASS';
} catch (error) {
  report.status = 'FAIL';
  // No Playwright diagnostics, request bodies, SMTP responses, credentials, or mail text.
  report.error = error.message.startsWith('Assertion failed:') || ['REAL_MAIL_RECEIPT_TIMEOUT', 'UNSAFE_HANDOFF_PERMISSIONS'].includes(error.message)
    ? error.message : error.name;
  process.exitCode = 1;
} finally {
  await browser?.close().catch(() => {});
  if (connected) {
    try {
      await db.query('begin');
      const own = (await db.query('select id from users where email=$1 and username=$2 and created_at >= $3 for update', [email, username, startedAt])).rows[0];
      if (own) {
        await db.query('delete from sessions where user_id=$1', [own.id]);
        await db.query('delete from email_verifications where email=$1 and created_at >= $2', [email, startedAt]);
        const deleted = await db.query('delete from users where id=$1 and email=$2 and username=$3', [own.id, email, username]);
        check('temporary_account_removed', deleted.rowCount === 1);
      }
      check('temporary_account_and_codes_absent', !registered || (await db.query('select count(*)::int as n from users where email=$1', [email])).rows[0].n === 0
        && (await db.query('select count(*)::int as n from email_verifications where email=$1 and created_at >= $2', [email, startedAt])).rows[0].n === 0);
      await db.query('commit');
      report.cleanup = 'PASS';
    } catch {
      await db.query('rollback').catch(() => {});
      report.cleanup = 'FAIL'; report.status = 'FAIL'; process.exitCode = 1;
    }
    await db.end();
  }
  report.finishedAt = new Date().toISOString();
  await fs.writeFile(path.join(artifactDir, 'real-mail-acceptance.json'), JSON.stringify(report, null, 2) + '\n');
  await fs.writeFile(path.join(artifactRoot, 'real-mail-acceptance.json'), JSON.stringify(report, null, 2) + '\n');
  await fs.writeFile(codesPath, JSON.stringify({ run, register: '', password_reset: '' }) + '\n', { mode: 0o600 });
  console.log(JSON.stringify(report, null, 2));
}
