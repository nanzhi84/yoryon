"""Stream private OSS media into a protected backup directory; root on production host.
Usage: python3 /opt/yoryon/backup-oss.py <empty-output-directory>
Only reads /etc/yoryon/cli.env; never prints credentials or signed URLs.
"""
import base64,datetime,hashlib,hmac,json,os,re,sys,urllib.parse,urllib.request,xml.etree.ElementTree as ET
from pathlib import Path
os.umask(0o077)
env=dict(line.split('=',1) for line in Path('/etc/yoryon/cli.env').read_text().splitlines() if '=' in line and not line.startswith('#'))
assert env['STORAGE_BACKEND']=='oss'
bucket=env['OSS_BUCKET']; region=env['OSS_REGION']
assert re.fullmatch(r'[a-z0-9-]+',bucket) and region=='oss-ap-southeast-1'
root=Path(sys.argv[1]);root.mkdir(mode=0o700,parents=True,exist_ok=False)
def request(key='',query=None):
 date=datetime.datetime.now(datetime.timezone.utc).strftime('%a, %d %b %Y %H:%M:%S GMT')
 resource=f'/{bucket}/'+key
 signature=base64.b64encode(hmac.new(env['OSS_ACCESS_KEY_SECRET'].encode(),f'GET\n\n\n{date}\n{resource}'.encode(),hashlib.sha1).digest()).decode()
 url=f'https://{bucket}.{region}.aliyuncs.com/'+urllib.parse.quote(key,safe='/')
 if query:url+='?'+urllib.parse.urlencode(query)
 req=urllib.request.Request(url,headers={'Date':date,'Authorization':f'OSS {env["OSS_ACCESS_KEY_ID"]}:{signature}'})
 return urllib.request.urlopen(req,timeout=60)
manifest=[];marker='';seen=set()
while True:
 with request(query={'prefix':'media/','max-keys':'1000','marker':marker}) as r: tree=ET.fromstring(r.read())
 for entry in tree.findall('Contents'):
  key=entry.findtext('Key'); assert re.fullmatch(r'media/[a-f0-9]{64}\.[a-z0-9]{1,10}',key),'Unexpected media key'
  assert key not in seen,'Duplicate listing key';seen.add(key)
  target=root/key;target.parent.mkdir(mode=0o700,exist_ok=True)
  digest=hashlib.sha256();size=0
  with request(key) as r,target.open('xb') as out:
   while chunk:=r.read(1024*1024):out.write(chunk);digest.update(chunk);size+=len(chunk)
  assert size==int(entry.findtext('Size')) and digest.hexdigest()==key.split('/')[1].split('.')[0],'Object hash or size differs'
  manifest.append({'key':key,'size':size,'sha256':digest.hexdigest()})
 if tree.findtext('IsTruncated')!='true':break
 next_marker=tree.findtext('NextMarker');assert next_marker and next_marker!=marker,'Pagination did not progress';marker=next_marker
(root/'manifest.json').write_text(json.dumps({'bucket':bucket,'region':region,'objects':manifest},indent=2))
print(json.dumps({'mediaObjects':len(manifest),'status':'PASS'}))
