/** Read-only independent cleanup verification; never reads code/password values. */
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { createRequire } from 'node:module';
const require = createRequire(new URL('../../packages/core/package.json', import.meta.url));
const { Client } = require('pg');
const arg = name => process.argv[process.argv.indexOf(name) + 1];
const email = arg('--email');
const since = arg('--since');
if (!process.argv.includes('--email') || !/^[^\s@]+@gmail\.com$/.test(email)) throw Error('Explicit authorized Gmail required');
if (!process.argv.includes('--since') || !/^\d{4}-\d{2}-\d{2}T/.test(since) || Number.isNaN(Date.parse(since))) throw Error('Explicit UTC start required');
const config = path.join(os.homedir(), '.config/yoryon-production');
const secrets = JSON.parse(await fs.readFile(path.join(config, 'secrets.json')));
const db = new Client({ connectionString: secrets.database_cli_url });
let connectionError;
db.on('error', error => { connectionError = error; });
let report;
try {
  await db.connect();
  const recipientAccounts = (await db.query('select count(*)::int n from users where email=$1', [email])).rows[0].n;
  const recipientVerificationRows = (await db.query('select count(*)::int n from email_verifications where email=$1 and created_at >= $2', [email, since])).rows[0].n;
  const acceptanceAccounts = (await db.query("select count(*)::int n from users where username like 'smtpqa%' and created_at >= $1", [since])).rows[0].n;
  if (connectionError) throw connectionError;
  const codesFile = path.join(config, 'mail-acceptance-codes.json');
  const handoff = JSON.parse(await fs.readFile(codesFile));
  const handoffCleared = handoff.register === '' && handoff.password_reset === '';
  const protectedHandoffPermissions = ((await fs.stat(codesFile)).mode & 0o077) === 0;
  report = { status: [recipientAccounts, recipientVerificationRows, acceptanceAccounts].every(n => n === 0)
      && handoffCleared && protectedHandoffPermissions ? 'PASS' : 'FAIL',
    checkedAt: new Date().toISOString(), since, recipient: 'explicitly_authorized_gmail',
    recipientAccounts, recipientVerificationRows, acceptanceAccounts, handoffCleared, protectedHandoffPermissions,
    codeValuesReadFromDatabase: false, readOnly: true };
} finally { await db.end().catch(() => {}); }
await fs.writeFile(new URL('./independent-cleanup.json', import.meta.url), JSON.stringify(report, null, 2) + '\n');
console.log(JSON.stringify(report));
if (report.status !== 'PASS') process.exitCode = 1;
