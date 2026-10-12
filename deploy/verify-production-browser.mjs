/** Browser acceptance companion: real UI, isolated contexts, no traces or credentials on disk. */
import { createRequire } from 'node:module';
import path from 'node:path';
const require = createRequire(new URL('../e2e/package.json', import.meta.url));
const { chromium, expect } = require('@playwright/test');

export async function startBrowserAcceptance({ base, slugs, run, email, password, username, check, smtpReady = false, artifactDir }) {
  const browser = await chromium.launch();
  const member = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const guest = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const page = await member.newPage();
  const anonymous = await guest.newPage();
  page.setDefaultTimeout(20000);
  anonymous.setDefaultTimeout(20000);
  const errors = [];
  for (const p of [page, anonymous]) p.on('pageerror', () => errors.push('uncaught browser error'));
  const go = (p, route) => p.goto(base + route, { waitUntil: 'networkidle', timeout: 30000 });
  const screenshot = (p, name) => p.screenshot({ path: path.join(artifactDir, name + '.png'), fullPage: true });
  const bodyMarker = kind => `BODY-${run}-${kind}`;
  async function visible(name, locator, expected) {
    await expect(locator).toContainText(expected);
    check(name, true);
  }
  async function hidden(name, p, marker) {
    check(name, !(await p.content()).includes(marker));
  }
  async function layout(p, name) {
    check(name, await p.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
  }
  return {
    async redeem(code) {
      await go(page, `/p/${slugs.public}`);
      await visible('browser_public_article_ssr_body', page.locator('main'), bodyMarker('public'));
      await expect(page.getByAltText('验收图片')).toBeVisible();
      check('browser_public_media_loaded', await page.getByAltText('验收图片').evaluate(img => img.complete && img.naturalWidth > 0));
      await screenshot(page, 'browser-public-desktop');
      await go(anonymous, `/p/${slugs.paid}`);
      await visible('browser_paid_wall_visible', anonymous.locator('main'), '本内容为订阅专享');
      await hidden('browser_guest_html_has_no_paid_body', anonymous, bodyMarker('paid'));
      await layout(anonymous, 'browser_mobile_no_horizontal_overflow');
      await screenshot(anonymous, 'browser-paid-locked-mobile');

      await go(page, '/login');
      await page.getByLabel('邮箱或用户名').fill(email);
      await page.getByLabel('密码', { exact: true }).fill(password);
      await page.getByRole('button', { name: '登录', exact: true }).click();
      await page.waitForURL(base + '/');
      const me = await page.evaluate(async () => (await fetch('/api/auth/me')).json());
      check('browser_login_form_and_bff_session', me.user?.username === username);
      const session = (await member.cookies()).find(c => c.name === 'yoryon_session');
      check('browser_session_cookie_secure_httponly', !!session?.httpOnly && !!session?.secure && session.sameSite === 'Lax');
      await go(page, '/redeem');
      await page.getByLabel('激活码', { exact: true }).fill(code);
      const responsePromise = page.waitForResponse(r => r.url() === base + '/api/redemptions' && r.request().method() === 'POST');
      await page.getByRole('button', { name: '兑换', exact: true }).click();
      const response = await responsePromise;
      const json = await response.json();
      await visible('browser_activation_form_success', page.locator('main').getByRole('alert'), '兑换成功');
      await expect(page.getByLabel('激活码', { exact: true })).toHaveValue('');
      await screenshot(page, 'browser-redemption-success');
      return { status: response.status(), json };
    },
    async unlocked() {
      await go(page, `/p/${slugs.paid}`);
      await visible('browser_entitled_paid_article_visible', page.locator('main'), bodyMarker('paid'));
      await expect(page.getByAltText('验收图片')).toBeVisible();
      check('browser_entitled_media_loaded', await page.getByAltText('验收图片').evaluate(img => img.complete && img.naturalWidth > 0));
      await screenshot(page, 'browser-paid-unlocked-desktop');
      await anonymous.reload({ waitUntil: 'networkidle' });
      await hidden('browser_separate_guest_stays_locked', anonymous, bodyMarker('paid'));
    },
    async revoked() {
      await page.reload({ waitUntil: 'networkidle' });
      await visible('browser_revoked_member_paywall', page.locator('main'), '本内容为订阅专享');
      await hidden('browser_revoked_member_body_hidden', page, bodyMarker('paid'));
      await screenshot(page, 'browser-revoked-member');
    },
    async edited() {
      await go(anonymous, `/p/${slugs.public}`);
      await visible('browser_published_edit_visible', anonymous.locator('main'), bodyMarker('public') + '-UPDATED');
      await layout(anonymous, 'browser_public_mobile_no_horizontal_overflow');
      await screenshot(anonymous, 'browser-public-edited-mobile');
    },
    async converted() {
      await anonymous.reload({ waitUntil: 'networkidle' });
      await hidden('browser_public_to_paid_removes_body', anonymous, bodyMarker('public'));
      await visible('browser_public_to_paid_shows_wall', anonymous.locator('main'), '本内容为订阅专享');
    },
    async unpublished() {
      await anonymous.reload({ waitUntil: 'networkidle' });
      await visible('browser_unpublished_shows_not_found', anonymous.locator('main'), '页面不存在');
      await hidden('browser_unpublished_body_absent', anonymous, bodyMarker('public'));
    },
    async finish() {
      // There is no logout control in the current UI; exercise its same-origin BFF request.
      const status = await page.evaluate(async () => {
        await fetch('/api/auth/logout', { method: 'POST' });
        return (await fetch('/api/auth/me')).status;
      });
      check('browser_logout_clears_session', status === 401 && !(await member.cookies()).some(c => c.name === 'yoryon_session'));
      await go(anonymous, '/register');
      if (smtpReady) {
        // Real registration and inbox delivery are verified separately with an authorized mailbox.
        await expect(anonymous.getByLabel('邮箱', { exact: true })).toBeVisible();
        await expect(anonymous.getByRole('button', { name: '注册', exact: true })).toBeEnabled();
        check('browser_registration_form_ready', true);
        await screenshot(anonymous, 'browser-registration-ready');
        check('browser_no_uncaught_javascript_errors', errors.length === 0);
        return;
      }
      await anonymous.getByLabel('邮箱', { exact: true }).fill(email);
      await anonymous.getByLabel('用户名', { exact: true }).fill(username);
      await anonymous.getByLabel(/密码/).fill(password);
      await anonymous.getByRole('button', { name: '注册', exact: true }).click();
      await visible('browser_pending_smtp_has_clear_error', anonymous.locator('main').getByRole('alert'), '邮件服务尚未配置');
      // Clear inputs before evidence capture; no password/email/code is saved.
      for (const locator of ['邮箱', '用户名']) await anonymous.getByLabel(locator, { exact: true }).fill('');
      await anonymous.getByLabel(/密码/).fill('');
      await screenshot(anonymous, 'browser-smtp-pending');
      check('browser_no_uncaught_javascript_errors', errors.length === 0);
    },
    close: () => browser.close(),
  };
}
