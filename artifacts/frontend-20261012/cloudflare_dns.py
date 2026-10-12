import json, subprocess, urllib.request
from pathlib import Path
ROOT = Path(__file__).resolve().parent
ZONE = '876891c86eddfcab51e93174e272d45e'
def request(path, method='GET', body=None):
    headers={'Content-Type':'application/json'}
    for service,header in [('com.lilink.cloudflare.global-api-key','X-Auth-Key'),('com.lilink.cloudflare.account-email','X-Auth-Email')]:
        headers[header]=subprocess.run(['security','find-generic-password','-s',service,'-a','lilink.top','-w'],capture_output=True,text=True,check=True).stdout.strip()
    req=urllib.request.Request('https://api.cloudflare.com/client/v4'+path,headers=headers,method=method,data=None if body is None else json.dumps(body).encode())
    with urllib.request.urlopen(req,timeout=45) as response: result=json.load(response)
    if not result['success']: raise RuntimeError(result['errors'])
    return result['result']
if __name__ == '__main__':
    records=request(f'/zones/{ZONE}/dns_records?per_page=100')
    (ROOT/'cloudflare-dns-current.json').write_text(json.dumps(records,indent=2))
    print(json.dumps({'records':[{k:r[k] for k in ['type','name','content','ttl','proxied'] if k in r} for r in records]}))
