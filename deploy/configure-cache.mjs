/** Configure signed cache events using protected stdin; no values enter command args/logs. */
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
import { spawn } from 'node:child_process';
const dir=path.join(os.homedir(),'.config/yoryon-production');
const file=path.join(dir,'cache-secret');
let secret;
try {secret=(await fs.readFile(file,'utf8')).trim();} catch(error) {if(error.code!=='ENOENT')throw error;secret=crypto.randomBytes(32).toString('hex');await fs.writeFile(file,secret,{mode:0o600});}
if(!/^[a-f0-9]{64}$/.test(secret))throw Error('Invalid protected secret');
async function run(cmd,args,input) {
  const child=spawn(cmd,args,{stdio:['pipe','pipe','pipe']});let out='';let err='';child.stdout.on('data',b=>out+=b);child.stderr.on('data',b=>err+=b);child.stdin.end(input);
  const code=await new Promise((resolve,reject)=>{child.on('error',reject);child.on('exit',resolve);});
  if(code!==0)throw Error(`${cmd} failed (${code}): ${err.replaceAll(secret,'[secret]')}`);
  return out;
}
const script=`import pathlib,json,sys,shutil\ndata=json.load(sys.stdin)\nfor name in ['api','cli']:\n p=pathlib.Path('/etc/yoryon/'+name+'.env')\n backup=p.with_suffix('.pre-cache.env')\n if not backup.exists(): shutil.copy2(p,backup)\n lines=[x for x in p.read_text().splitlines() if not x.startswith(('CACHE_REVALIDATE_SECRET=','CACHE_REVALIDATE_URL='))]\n lines+=['CACHE_REVALIDATE_SECRET='+data['secret'],'CACHE_REVALIDATE_URL=https://yoryon.com/api/revalidate']\n p.write_text('\\n'.join(lines)+'\\n');p.chmod(0o600)\nprint('protected cache configuration installed')\n`;
const encoded=Buffer.from(script).toString('base64');
await run('ssh',['-o','BatchMode=yes','admin@8.222.152.17',`sudo python3 -c "import base64;exec(base64.b64decode('${encoded}'))"`],JSON.stringify({secret}));
await run('vercel',['env','add','CACHE_REVALIDATE_SECRET','production','--sensitive','--force','--yes','--scope','zyy2740738166-7111s-projects'],secret+'\n');
await run('vercel',['env','add','FEED_REVALIDATE_SEC','production','--force','--yes','--scope','zyy2740738166-7111s-projects'],'86400\n');
console.log('Production cache settings configured; restart API with new image before staging frontend.');
