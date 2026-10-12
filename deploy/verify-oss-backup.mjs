/** Real OSS -> production backup -> restored-byte acceptance; only synthetic media.
 * Requires installed backup scripts, SSH access and protected oss-credentials.json.
 * Run: node deploy/verify-oss-backup.mjs
 */
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
import {createRequire} from 'node:module';
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
const exec=promisify(execFile),require=createRequire(new URL('../packages/core/package.json',import.meta.url));
const c=JSON.parse(await fs.readFile(path.join(os.homedir(),'.config/yoryon-production/oss-credentials.json')));
const oss=new (require('ali-oss'))({region:c.region,bucket:c.bucket,secure:true,...c.cli});
const bytes=Buffer.from(`backup synthetic ${crypto.randomUUID()}`),hash=crypto.createHash('sha256').update(bytes).digest('hex'),key=`media/${hash}.txt`;
const checks=[],report={startedAt:new Date().toISOString(),checks};
const ssh=cmd=>exec('ssh',['-o','BatchMode=yes','admin@8.222.152.17',cmd],{timeout:60000,maxBuffer:1024*1024});
function check(name,ok){checks.push({name,status:ok?'PASS':'FAIL'});if(!ok)throw Error(name);}
try{
 await oss.put(key,bytes,{mime:'text/plain',headers:{'Cache-Control':'private, max-age=604800'}});
 const out=(await ssh('sudo /opt/yoryon/backup-neon.sh')).stdout;
 const stamp=out.match(/backup completed: (\d{8}T\d{6}Z)/)?.[1];check('backup_completed',!!stamp);
 report.backup=`/var/backups/yoryon/${stamp}`;
 check('backup_archive_checksums',(await ssh(`sudo sh -c 'cd ${report.backup} && sha256sum -c SHA256SUMS'`)).stdout.includes('media.tar.gz: OK'));
 const restored=(await ssh(`sudo tar -xOzf ${report.backup}/media.tar.gz ./${key} | sha256sum`)).stdout.split(' ')[0];
 check('oss_media_restore_hash',restored===hash);
 report.status='PASS';
}catch(e){report.status='FAIL';report.error='Backup acceptance failed; inspect protected server state';process.exitCode=1;}
finally{await oss.delete(key);check('synthetic_object_cleanup',!(await oss.list({prefix:key},{})).objects?.length);report.finishedAt=new Date().toISOString();await fs.mkdir(new URL('../artifacts/oss-20261012/',import.meta.url),{recursive:true});await fs.writeFile(new URL('../artifacts/oss-20261012/backup-acceptance.json',import.meta.url),JSON.stringify(report,null,2));console.log(JSON.stringify(report,null,2));}
