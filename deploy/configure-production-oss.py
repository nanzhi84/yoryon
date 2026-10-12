"""Provision isolated OSS identities. Run before configure-production-oss.mjs.
Uses ~/.alibabacloud/credentials; saves keys only in protected local configuration.
"""
import importlib.util,json,os
from pathlib import Path
spec=importlib.util.spec_from_file_location('rpc',Path(__file__).with_name('aliyun-rpc.py'))
m=importlib.util.module_from_spec(spec);spec.loader.exec_module(m)
ACCOUNT='1089191161022541'
BUCKET=f'yoryon-media-{ACCOUNT}-sg'
root=Path.home()/'.config/yoryon-production'; target=root/'oss-credentials.json'
assert m.rpc('GetCallerIdentity',service='sts',version='2015-04-01')['AccountId']==ACCOUNT
state=json.loads(target.read_text()) if target.exists() else {'bucket':BUCKET,'region':'oss-ap-southeast-1'}
assert state['bucket']==BUCKET
users={x['UserName'] for x in m.rpc('ListUsers')['Users'].get('User',[])}
policies={x['PolicyName'] for x in m.rpc('ListPolicies',{'PolicyType':'Custom'})['Policies'].get('Policy',[])}
for role in ['api','cli']:
 name=f'yoryon-oss-{role}'
 statements=[{'Effect':'Allow','Action':['oss:GetObject'],'Resource':[f'acs:oss:*:*:{BUCKET}/media/*']}]
 if role=='cli':
  statements[0]['Action']+=['oss:PutObject','oss:DeleteObject','oss:ListParts','oss:AbortMultipartUpload']
  statements.append({'Effect':'Allow','Action':['oss:ListObjects'],'Resource':[f'acs:oss:*:*:{BUCKET}'],'Condition':{'StringLike':{'oss:Prefix':['media/','media/*']}}})
 policy={'Version':'1','Statement':statements}
 policyname=f'YoryonOss{role.title()}Media'
 if name not in users: m.rpc('CreateUser',{'UserName':name,'DisplayName':name})
 if policyname not in policies: m.rpc('CreatePolicy',{'PolicyName':policyname,'PolicyDocument':json.dumps(policy)})
 else:
  p=m.rpc('GetPolicy',{'PolicyName':policyname,'PolicyType':'Custom'})['Policy']
  v=m.rpc('GetPolicyVersion',{'PolicyName':policyname,'PolicyType':'Custom','VersionId':p['DefaultVersion']})['PolicyVersion']
  assert json.loads(v['PolicyDocument'])==policy,'Existing policy differs'
 m.rpc('AttachPolicyToUser',{'PolicyName':policyname,'PolicyType':'Custom','UserName':name})
 if role not in state:
  keys=m.rpc('ListAccessKeys',{'UserName':name})['AccessKeys'].get('AccessKey',[])
  assert not keys,'Existing unmanaged access keys; refusing to create duplicate'
  key=m.rpc('CreateAccessKey',{'UserName':name})['AccessKey']
  state[role]={'accessKeyId':key['AccessKeyId'],'accessKeySecret':key['AccessKeySecret']}
  fd=os.open(target,os.O_WRONLY|os.O_CREAT|os.O_TRUNC,0o600)
  with os.fdopen(fd,'w') as f:json.dump(state,f)
 print(role,'identity configured')
