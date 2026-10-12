import configparser,json,urllib.request,urllib.parse,hmac,hashlib,base64,uuid,datetime,sys
from pathlib import Path
c=configparser.ConfigParser();c.read(Path.home()/'.alibabacloud/credentials'); cred=c['default']
def rpc(action,params={},service='ram',version='2015-05-01'):
 p=dict(params,Action=action,Version=version,Format='JSON',AccessKeyId=cred['access_key_id'],SignatureMethod='HMAC-SHA1',SignatureVersion='1.0',SignatureNonce=str(uuid.uuid4()),Timestamp=datetime.datetime.now(datetime.timezone.utc).strftime('%Y-%m-%dT%H:%M:%SZ'))
 enc=lambda x:urllib.parse.quote(str(x),safe='~')
 q='&'.join(enc(k)+'='+enc(p[k]) for k in sorted(p))
 sig=base64.b64encode(hmac.new((cred['access_key_secret']+'&').encode(),('POST&%2F&'+enc(q)).encode(),hashlib.sha1).digest()).decode()
 req=urllib.request.Request('https://'+service+'.aliyuncs.com/',data=(q+'&Signature='+enc(sig)).encode())
 try:
  with urllib.request.urlopen(req,timeout=30) as r: return json.load(r)
 except urllib.error.HTTPError as e:
  d=json.load(e); raise RuntimeError(d.get('Code','HTTPError')) from None
