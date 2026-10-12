/** Run after configure-production-oss.py. Provision, verify, then switch API/CLI.
 * Credentials stay in ~/.config/yoryon-production and /etc/yoryon; failures restore FS.
 */
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import crypto from 'node:crypto';
import { createRequire } from 'node:module';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
const exec=promisify(execFile), require=createRequire(new URL('../packages/core/package.json',import.meta.url));
const OSS=require('ali-oss'),{Client}=require('pg');
const root=path.join(os.homedir(),'.config/yoryon-production');
const state=JSON.parse(await fs.readFile(path.join(root,'oss-credentials.json')));
const secrets=JSON.parse(await fs.readFile(path.join(root,'secrets.json')));
const master=JSON.parse((await exec('python3',['-c',`import configparser,json;from pathlib import Path;c=configparser.ConfigParser();c.read(Path.home()/'.alibabacloud/credentials');print(json.dumps(dict(c['default'])))`])).stdout);
const bucket=state.bucket, region=state.region;
if(bucket!=='yoryon-media-1089191161022541-sg'||region!=='oss-ap-southeast-1')throw Error('Unexpected target');
const client=keys=>new OSS({region,bucket,secure:true,timeout:30000,...keys});
const admin=client({accessKeyId:master.access_key_id,accessKeySecret:master.access_key_secret});
const api=client(state.api),cli=client(state.cli);
const artifact=new URL('../artifacts/oss-20261012/',import.meta.url);await fs.mkdir(artifact,{recursive:true});
const report={startedAt:new Date().toISOString(),bucket,region,checks:[]};
function check(name,ok){report.checks.push({name,status:ok?'PASS':'FAIL'});if(!ok)throw Error(name);}
const ssh=command=>exec('ssh',['-o','BatchMode=yes','-o','ConnectTimeout=10','admin@8.222.152.17',command],{timeout:60000,maxBuffer:1024*1024});
let db, remoteTemp;
try{
 let exists=true;try{await admin.getBucketLocation(bucket);}catch(e){if(e.code==='NoSuchBucket')exists=false;else throw e;}
 if(!exists && process.argv.includes('--verify-only'))throw Error('Bucket does not exist');
 if(!exists)await admin.putBucket(bucket,{acl:'private',storageClass:'Standard',dataRedundancyType:'LRS'});
 check('singapore_region',(await admin.getBucketLocation(bucket)).location==='oss-ap-southeast-1');
 if(!process.argv.includes('--verify-only'))await admin.putBucketACL(bucket,'private');
 check('private_bucket',(await admin.getBucketACL(bucket)).acl==='private');
 let params=admin._bucketRequestParams('PUT',bucket,'publicAccessBlock',{});
 params.content='<PublicAccessBlockConfiguration><BlockPublicAccess>true</BlockPublicAccess></PublicAccessBlockConfiguration>';
 params.mime='xml';params.successStatuses=[200];if(!process.argv.includes('--verify-only'))await admin.request(params);
 params=admin._bucketRequestParams('GET',bucket,'publicAccessBlock',{});params.successStatuses=[200];
 check('public_access_blocked',String((await admin.request(params)).data).includes('<BlockPublicAccess>true</BlockPublicAccess>'));
 if(!process.argv.includes('--verify-only'))await admin.putBucketEncryption(bucket,{SSEAlgorithm:'AES256'});
 check('aes256_encryption',(await admin.getBucketEncryption(bucket)).encryption.SSEAlgorithm==='AES256');
 const bytes=Buffer.from(`OSS acceptance ${crypto.randomUUID()}`),key=`media/${crypto.createHash('sha256').update(bytes).digest('hex')}.txt`;
 try{
  await cli.put(key,bytes,{mime:'text/plain',headers:{'Cache-Control':'private, max-age=604800'}});
  check('cli_upload_api_read',Buffer.compare((await api.get(key)).content,bytes)===0);
  let denied=false;try{await api.put(key,bytes);}catch(e){denied=e.status===403;}check('api_write_denied',denied);
  const signed=api.signatureUrl(key,{expires:60}), response=await fetch(signed,{signal:AbortSignal.timeout(20000)});
  check('signed_get_hash',response.ok&&Buffer.compare(Buffer.from(await response.arrayBuffer()),bytes)===0);
  const plain=new URL(signed);plain.search='';const unsigned=await fetch(plain,{signal:AbortSignal.timeout(20000)});check('unsigned_get_denied',unsigned.status===403);await unsigned.arrayBuffer();
  await cli.list({prefix:'media/','max-keys':1},{});check('cli_media_list',true);
 }finally{await cli.delete(key);}
 if(process.argv.includes('--verify-only')) {
  for(const role of ['api','cli']) {
   const env=Object.fromEntries((await ssh(`sudo cat /etc/yoryon/${role}.env`)).stdout.split('\n').filter(l=>l.includes('=')).map(l=>[l.slice(0,l.indexOf('=')),l.slice(l.indexOf('=')+1)]));
   check(`${role}_production_oss_configuration`,env.STORAGE_BACKEND==='oss' && env.OSS_BUCKET===bucket && env.OSS_REGION===region && env.OSS_ACCESS_KEY_ID===state[role].accessKeyId && env.OSS_ACCESS_KEY_SECRET===state[role].accessKeySecret);
  }
 } else {
 db=new Client({connectionString:secrets.database_cli_url});await db.connect();
 const assets=(await db.query('select oss_key from media_assets')).rows;
 report.existingMedia=assets.length;
 const files=(await ssh('sudo find /var/lib/yoryon/media -type f -printf "%P\\n"')).stdout.trim();
 if(assets.length||files)throw Error('Existing media require locked migration; configuration not switched');
 const temp=await fs.mkdtemp(path.join(root,'oss-install-'));await fs.chmod(temp,0o700);
 try{
  for(const role of ['api','cli']){
   const original=(await ssh(`sudo cat /etc/yoryon/${role}.env`)).stdout;
   const backup=path.join(root,'backups',`${role}-pre-oss.env`);await fs.writeFile(backup,original,{mode:0o600,flag:'wx'});
   const lines=original.split('\n').filter(l=>!l.startsWith('OSS_')&&!l.startsWith('STORAGE_BACKEND='));
   lines.push('STORAGE_BACKEND=oss',`OSS_REGION=${region}`,`OSS_BUCKET=${bucket}`,`OSS_ACCESS_KEY_ID=${state[role].accessKeyId}`,`OSS_ACCESS_KEY_SECRET=${state[role].accessKeySecret}`);
   await fs.writeFile(path.join(temp,`${role}.env`),lines.join('\n')+'\n',{mode:0o600});
  }
  remoteTemp=(await ssh('mktemp -d /tmp/yoryon-oss-XXXXXXXX')).stdout.trim();
  if(!/^\/tmp\/yoryon-oss-[a-zA-Z0-9]+$/.test(remoteTemp))throw Error('Unexpected temporary path');
  await exec('scp',[path.join(temp,'api.env'),path.join(temp,'cli.env'),`admin@8.222.152.17:${remoteTemp}/`],{timeout:30000});
  try{await ssh(`sudo cp -n /etc/yoryon/api.env /etc/yoryon/api.pre-oss.env && sudo cp -n /etc/yoryon/cli.env /etc/yoryon/cli.pre-oss.env && sudo install -m 600 -o root -g root ${remoteTemp}/api.env /etc/yoryon/api.env && sudo install -m 600 -o root -g root ${remoteTemp}/cli.env /etc/yoryon/cli.env && rm -f ${remoteTemp}/api.env ${remoteTemp}/cli.env`);
  await ssh('cd /opt/yoryon && sudo docker compose -f compose.neon.yml up -d --wait api');}
  catch{await ssh('sudo cp /etc/yoryon/api.pre-oss.env /etc/yoryon/api.env && sudo cp /etc/yoryon/cli.pre-oss.env /etc/yoryon/cli.env && cd /opt/yoryon && sudo docker compose -f compose.neon.yml up -d --wait api');throw Error('Switch failed; previous environment restored');}
  check('production_configuration_switched',true);
 }finally{if(remoteTemp)await ssh(`rm -rf -- ${remoteTemp}`).catch(()=>{});await fs.rm(temp,{recursive:true,force:true});}
 }
 report.status='PASS';
}catch(e){report.status='FAIL';report.error=e.code??(report.checks.at(-1)?.status==='FAIL'?e.message:'Configuration failed; inspect protected process state');process.exitCode=1;}
finally{await db?.end();report.finishedAt=new Date().toISOString();await fs.writeFile(new URL('configuration.json',artifact),JSON.stringify(report,null,2));console.log(JSON.stringify(report,null,2));}
