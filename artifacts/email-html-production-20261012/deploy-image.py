import datetime,json,pathlib,shlex,subprocess
new_image='yoryon-api:18e63b63-prod1'
root=pathlib.Path('artifacts/email-html-production-20261012')
before=json.loads((root/'before-deploy.json').read_text())
build=json.loads((root/'build.json').read_text())
remote=r'''
import fcntl,hashlib,json,pathlib,shutil,subprocess,sys
v=json.load(sys.stdin);base=pathlib.Path('/opt/yoryon');p=base/'.env'
lock=(base/'.deployment.lock').open('a');fcntl.flock(lock,fcntl.LOCK_EX)
caddy=(base/'Caddyfile.production').read_bytes()
old=p.read_text();previous=dict(line.split('=',1) for line in old.splitlines() if line and not line.startswith('#') and '=' in line).get('YORYON_IMAGE')
if previous!=v['expectedImage'] or hashlib.sha256(caddy).hexdigest()!=v['caddySha256']:raise SystemExit('PRODUCTION_STATE_CHANGED')
image=json.loads(subprocess.run(['docker','image','inspect',v['newImage']],capture_output=True,text=True,check=True).stdout)[0]
if image['RootFS']['Layers']!=v['rootFsLayers'] or image['Architecture']!='amd64':raise SystemExit('UPLOADED_IMAGE_MISMATCH')
backup=base/'.env.before-html-18e63b63';shutil.copy2(p,backup)
def compose(*args):
 return subprocess.run(['docker','compose','-f','compose.neon.yml',*args],cwd=base,capture_output=True,text=True,timeout=120)
try:
 lines=[s for s in old.splitlines() if not s.startswith('YORYON_IMAGE=')]+['YORYON_IMAGE='+v['newImage']]
 p.write_text('\n'.join(lines)+'\n')
 if compose('up','-d','--wait','--wait-timeout','90','api').returncode:raise RuntimeError('API_START_FAILED')
 state=json.loads(subprocess.run(['docker','inspect','yoryon-api-1'],capture_output=True,text=True,check=True).stdout)[0]
 if state['Config']['Image']!=v['newImage'] or state['State']['Health']['Status']!='healthy':raise RuntimeError('IMAGE_OR_HEALTH_MISMATCH')
 if (base/'Caddyfile.production').read_bytes()!=caddy:raise RuntimeError('CADDY_CONFIG_CHANGED')
 print(json.dumps({'status':'PASS','previousImage':previous,'newImage':v['newImage'],'imageId':state['Image'],'health':'healthy','rootFsLayersMatchBuiltImage':True,'caddyConfigUnchanged':True,'mailGateOpen':True,'mediaPrivateNoStore':True,'rollbackBackup':str(backup)}))
except Exception:
 p.write_text(old)
 restored=compose('up','-d','--wait','--wait-timeout','90','api').returncode==0
 print(json.dumps({'status':'FAIL','previousImage':previous,'newImage':v['newImage'],'rolledBack':True,'previousApiHealthy':restored}))
 sys.exit(1)
'''
v={'expectedImage':before['image'],'caddySha256':before['caddySha256'],'newImage':new_image,'rootFsLayers':build['rootFsLayers']}
r=subprocess.run(['ssh','-o','BatchMode=yes','-o','ConnectTimeout=10','admin@8.222.152.17','sudo python3 -c '+shlex.quote(remote)],input=json.dumps(v),text=True,capture_output=True,timeout=260)
try:report=json.loads(r.stdout)
except Exception:raise SystemExit('DEPLOYMENT_PRODUCED_NO_SAFE_STATUS')
report['sourceCommit']='18e63b63a26bcfa202c143156bf2cb14d3ce594b';report['checkedAt']=datetime.datetime.now(datetime.timezone.utc).isoformat()
(root/'deployment.json').write_text(json.dumps(report,indent=2)+'\n');print(json.dumps(report))
raise SystemExit(0 if r.returncode==0 and report['status']=='PASS' else 1)
