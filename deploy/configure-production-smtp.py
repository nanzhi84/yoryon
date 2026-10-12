"""Install protected SMTP configuration and verify login, without sending mail.

Run: python3 deploy/configure-production-smtp.py
Requires ~/.config/yoryon-production/smtp-credentials.json (0600) and deployment SSH access.
Keeps the public registration gate intact. Rolls back the env on failure.
"""
import json
import os
from pathlib import Path
import shlex
import subprocess

source = Path.home() / '.config/yoryon-production/smtp-credentials.json'
if source.stat().st_mode & 0o077:
    raise RuntimeError('SMTP configuration must be private')
config = json.loads(source.read_text())
if (config['host'], config['port'], config['user']) != (
    'smtpdm.aliyun.com', 465, 'noreply@notify.yoryon.com',
):
    raise RuntimeError('Unexpected SMTP destination')
password = config.get('password', '')
if not (10 <= len(password) <= 20 and password.isascii() and all(32 < ord(c) < 127 for c in password)):
    raise RuntimeError('Invalid or missing SMTP credential')
values = {
    'MAIL_SMTP_HOST': config['host'], 'MAIL_SMTP_PORT': str(config['port']),
    'MAIL_SMTP_USER': config['user'], 'MAIL_SMTP_PASS': password,
    'MAIL_FROM': 'Yoryon <noreply@notify.yoryon.com>',
}
preflight = r"""
const fs=require('node:fs'),{createRequire}=require('node:module');
let t;
(async()=>{try{
 const c=JSON.parse(fs.readFileSync(0,'utf8'));
 const req=createRequire(fs.realpathSync('/app/node_modules/@yoryon/core/package.json'));
 t=req('nodemailer').createTransport({host:c.host,port:c.port,secure:true,
   auth:{user:c.user,pass:c.password},connectionTimeout:15000,greetingTimeout:15000,socketTimeout:15000});
 await t.verify();console.log(JSON.stringify({authenticated:true,host:c.host,port:c.port}));
}catch(e){console.log(JSON.stringify({authenticated:false,error_code:e.code??e.name}));process.exitCode=1}
finally{t?.close()}})();
"""
probe = subprocess.run(
    ['ssh','-o','BatchMode=yes','-o','ConnectTimeout=10','admin@8.222.152.17',
     'sudo docker exec -i yoryon-api-1 node -e ' + shlex.quote(preflight)],
    input=json.dumps(config),capture_output=True,text=True,timeout=40,
)
try:
    probe_report = json.loads(probe.stdout)
except Exception:
    raise RuntimeError('SMTP authentication preflight produced no safe status') from None
print(json.dumps(probe_report),flush=True)
if probe.returncode or not probe_report.get('authenticated'):
    raise SystemExit(1)

remote = r'''
import datetime, fcntl, json, os, pathlib, shutil, subprocess, sys
values = json.load(sys.stdin)
root = pathlib.Path('/etc/yoryon')
stamp = datetime.datetime.now(datetime.timezone.utc).strftime('%Y%m%dT%H%M%SZ')
lock = (root / 'smtp-config.lock').open('a')
fcntl.flock(lock, fcntl.LOCK_EX)
backups = {}
stage = 'install_env'
def compose(*args):
    return subprocess.run(['docker','compose','-f','compose.neon.yml',*args],
        cwd='/opt/yoryon',capture_output=True,text=True,timeout=120)
try:
    for name in ['api.env','cli.env']:
        target = root / name
        backup = root / (name + '.before-smtp-' + stamp)
        shutil.copy2(target, backup)
        os.chmod(backup, 0o600)
        backups[target] = backup
        lines = [s for s in target.read_text().splitlines() if s.split('=',1)[0] not in values]
        # Compose env files use single quotes literally, including '$' and '#'.
        lines += [key + "='" + value.replace("'", "\\'") + "'" for key,value in values.items()]
        scratch = target.with_suffix('.env.new')
        fd = os.open(scratch, os.O_CREAT|os.O_TRUNC|os.O_WRONLY, 0o600)
        with os.fdopen(fd,'w') as f: f.write(chr(10).join(lines)+chr(10))
        os.replace(scratch,target)
    stage = 'restart_api'
    if compose('up','-d','--wait','--wait-timeout','90','api').returncode:
        raise RuntimeError('API_START_FAILED')
    stage = 'verify_smtp'
    code = """
const {createRequire}=require('node:module');
const req=createRequire(require('node:fs').realpathSync('/app/node_modules/@yoryon/core/package.json'));
const e=process.env;
if(e.MAIL_SMTP_HOST!=='smtpdm.aliyun.com'||e.MAIL_SMTP_PORT!=='465'||e.MAIL_SMTP_USER!=='noreply@notify.yoryon.com') process.exit(2);
const t=req('nodemailer').createTransport({host:e.MAIL_SMTP_HOST,port:465,secure:true,
  auth:{user:e.MAIL_SMTP_USER,pass:e.MAIL_SMTP_PASS},connectionTimeout:15000,greetingTimeout:15000,socketTimeout:15000});
t.verify().then(()=>console.log('SMTP_AUTH_VERIFIED')).catch(()=>{process.exitCode=1}).finally(()=>t.close());
"""
    verified = compose('exec','-T','api','node','-e',code)
    if verified.returncode or 'SMTP_AUTH_VERIFIED' not in verified.stdout:
        raise RuntimeError('SMTP_AUTH_FAILED')
    print(json.dumps({'status':'PASS','smtp_authentication':'VERIFIED','gate_removed':False,'backup_suffix':stamp}))
except Exception:
    for target,backup in backups.items(): shutil.copy2(backup,target)
    restored = compose('up','-d','--wait','--wait-timeout','90','api').returncode == 0
    print(json.dumps({'status':'FAIL','failure_stage':stage,'env_rolled_back':True,'api_restored':restored}))
    sys.exit(1)
'''
result = subprocess.run(
    ['ssh','-o','BatchMode=yes','-o','ConnectTimeout=10','admin@8.222.152.17',
     'sudo python3 -c ' + shlex.quote(remote)],
    input=json.dumps(values), capture_output=True, text=True, timeout=260,
)
try:
    report = json.loads(result.stdout)
except Exception:
    # Never print captured subprocess diagnostics; these may contain environment values.
    raise RuntimeError('SMTP install produced no safe status report') from None
artifact = Path(__file__).resolve().parent.parent / 'artifacts/directmail-20261012/smtp-install.json'
artifact.write_text(json.dumps(report,indent=2)+'\n')
print(json.dumps(report))
raise SystemExit(0 if result.returncode == 0 and report['status'] == 'PASS' else 1)
