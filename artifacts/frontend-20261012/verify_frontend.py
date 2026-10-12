"""Read-only frontend/domain acceptance; never creates accounts or submits forms."""
import json, re, socket, subprocess, tempfile
from datetime import datetime, timezone
from pathlib import Path
from urllib.parse import urljoin

ROOT = Path(__file__).resolve().parent
results = []

def check(name, ok, evidence):
    results.append({'name': name, 'status': 'PASS' if ok else 'FAIL', 'evidence': evidence})

def dns(name, kind, server=None):
    args = ['dig'] + ([f'@{server}'] if server else []) + ['+short', name, kind]
    p = subprocess.run(args, capture_output=True, text=True, timeout=20)
    return sorted(line.strip().rstrip('.') for line in p.stdout.splitlines() if line.strip())

def fetch(url, resolved_ip=None):
    with tempfile.TemporaryDirectory() as directory:
        h = Path(directory)/'headers'; b = Path(directory)/'body'
        network = ['--noproxy','*','--resolve',f'{url.split("/")[2]}:443:{resolved_ip}'] if resolved_ip else []
        p = subprocess.run(['curl',*network,'--silent','--show-error','--location','--max-time','25',
                            '--dump-header',str(h),'--output',str(b),'--write-out','%{http_code} %{remote_ip}',url],
                           capture_output=True,text=True,timeout=30)
        headers = {}
        if h.exists():
            for line in h.read_text().splitlines():
                if ':' in line:
                    k,v=line.split(':',1)
                    if k.lower() in ['server','content-type','x-vercel-id','x-vercel-cache']:
                        headers[k.lower()]=v.strip()
        body = b.read_text(errors='replace') if b.exists() else ''
        metrics = p.stdout.split()
        return {'status':int(metrics[0]) if metrics else 0,'remoteIP':metrics[1] if len(metrics)>1 else None,
                'networkPath':'direct TLS to public DNS address' if resolved_ip else 'ordinary local environment',
                'curlExit':p.returncode,'headers':headers,'error':p.stderr.strip()}, body

expected_ns = ['gerardo.ns.cloudflare.com','karsyn.ns.cloudflare.com']
local_cache = {kind:dns('yoryon.com',kind) for kind in ['NS','A','AAAA']}
ns = dns('yoryon.com','NS','1.1.1.1')
check('Cloudflare public resolver nameservers', ns == expected_ns, ns)
expected_a = ['216.198.79.1','64.29.17.1']
public_a = dns('yoryon.com','A','1.1.1.1')
check('public resolver apex A', public_a == expected_a, public_a)
check('system resolver apex A', local_cache['A'] == expected_a, local_cache['A'])
check('no legacy IPv6', local_cache['AAAA'] == [], local_cache['AAAA'])
check('www Vercel CNAME', dns('www.yoryon.com','CNAME') == ['4201314e4d3257a5.vercel-dns-017.com'], dns('www.yoryon.com','CNAME'))
for server in expected_ns:
    a = dns('yoryon.com','A',server)
    check(f'{server} apex A', a == expected_a, a)
    mx = dns('yoryon.com','MX',server)
    check(f'{server} mail MX', mx == sorted(['5 mx1.qiye.aliyun.com','10 mx2.qiye.aliyun.com','15 mx3.qiye.aliyun.com']), mx)

local_observations = []
for host in ['yoryon.com','www.yoryon.com']:
    response, html = fetch(f'https://{host}/')
    local_observations.append({'host':host,**response,'expectedHomepage':'<title>Yoryon</title>' in html,
                               'osAddresses':sorted({x[4][0] for x in socket.getaddrinfo(host,443)})})
    response, html = fetch(f'https://{host}/',public_a[0])
    check(host+' HTTPS homepage', response['status']==200 and response['curlExit']==0 and '<title>Yoryon</title>' in html and '还没有内容，敬请期待。' in html,
          {**response,'title':'Yoryon' if '<title>Yoryon</title>' in html else 'unexpected','expectedEmptyState':'还没有内容，敬请期待。' in html})
    if host == 'yoryon.com' and response['status']==200 and '<title>Yoryon</title>' in html:
        for route,label in [('/about','关于'),('/c','合集'),('/login','登录'),('/register','注册'),('/reset-password','重置密码'),('/redeem','订阅')]:
            r,b = fetch(urljoin('https://'+host,route),public_a[0])
            check('frontend route '+route,r['status']==200 and label in b,{**r,'expectedLabel':label,'labelPresent':label in b})
        assets = list(dict.fromkeys(re.findall(r'(?:src|href)="([^" ]+\.(?:js|css)(?:\?[^" ]*)?)"',html)))
        check('homepage references JS and CSS',any('.js' in x for x in assets) and any('.css' in x for x in assets),{'count':len(assets)})
        for asset in assets:
            if not asset.startswith('/_next/'): continue
            r,b = fetch(urljoin('https://'+host,asset),public_a[0])
            check('asset '+asset,r['status']==200 and len(b)>0,{**r,'bytes':len(b)})
for ip in public_a[1:]:
    r,b=fetch('https://yoryon.com/',ip)
    check('alternate public A HTTPS '+ip,r['status']==200 and '<title>Yoryon</title>' in b,r)

repo=subprocess.run(['gh','api','repos/nanzhi84/yoryon-homepage','--jq','.full_name'],capture_output=True,text=True,timeout=30)
check('old repository preserved',repo.returncode==0 and repo.stdout.strip()=='nanzhi84/yoryon-homepage',{'returnCode':repo.returncode})
pages=subprocess.run(['gh','api','repos/nanzhi84/yoryon-homepage/pages'],capture_output=True,text=True,timeout=30)
check('old GitHub Pages disabled',pages.returncode!=0 and '404' in pages.stderr,{'returnCode':pages.returncode,'notFound':'404' in pages.stderr})
workflow=subprocess.run(['gh','api','repos/nanzhi84/yoryon-homepage/actions/workflows/277380023','--jq','.state'],capture_output=True,text=True,timeout=30)
check('old deploy workflow disabled',workflow.stdout.strip()=='disabled_manually',{'state':workflow.stdout.strip()})
report={'checkedAt':datetime.now(timezone.utc).isoformat(),'scope':'frontend and domain only; API not deployed',
        'systemResolverCache':local_cache,
        'ordinaryLocalAccess':local_observations,
        'localAccessStatus':'PASS' if all(x['expectedHomepage'] for x in local_observations) else 'PENDING_DNS_CACHE',
        'expectedCommit':'882221fb4405a08567e746c729af5868fa2e0110','expectedDeployment':'dpl_57KbcBKhsNqjsqsPw3qsFnuSPxuL',
        'businessAcceptance':'UNVERIFIED: registration, login, content, subscription, media depend on production API',
        'checks':results,'pass':sum(x['status']=='PASS' for x in results),'fail':sum(x['status']=='FAIL' for x in results)}
(ROOT/'acceptance.json').write_text(json.dumps(report,ensure_ascii=False,indent=2))
print(json.dumps({'pass':report['pass'],'fail':report['fail'],'failedChecks':[x['name'] for x in results if x['status']=='FAIL']},ensure_ascii=False))
raise SystemExit(1 if report['fail'] else 0)
