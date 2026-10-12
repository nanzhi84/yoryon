"""Add only new DirectMail DNS records; preserve all existing zone records.

Run: python3 artifacts/directmail-20261012/apply-dns.py
Prerequisite: dns-desired.json copied from this domain's current DirectMail UI.
Uses the existing Cloudflare account credentials in macOS Keychain.
"""
import importlib.util
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parent
helper = ROOT.parent / 'frontend-20261012/cloudflare_dns.py'
spec = importlib.util.spec_from_file_location('cloudflare_dns', helper)
cf = importlib.util.module_from_spec(spec)
spec.loader.exec_module(cf)
desired = json.loads((ROOT / 'dns-desired.json').read_text())
allowed = {
    ('TXT', 'notify.yoryon.com'),
    ('MX', 'notify.yoryon.com'),
    ('TXT', '_dmarc.notify.yoryon.com'),
    ('TXT', 'aliyun-cn-hangzhou-2048._domainkey.notify.yoryon.com'),
}
keys = {(r['type'], r['name']) for r in desired}
if not (3 <= len(desired) <= 4 and len(keys) == len(desired) and keys <= allowed):
    raise RuntimeError('Unexpected domain records; no changes made')

before = cf.request(f'/zones/{cf.ZONE}/dns_records?per_page=100')
if not (ROOT / 'dns-before.json').exists():
    (ROOT / 'dns-before.json').write_text(json.dumps(before, indent=2))
added = []
for record in desired:
    existing = [r for r in before if r['name'] == record['name'] and r['type'] == record['type']]
    if any(r['type'] == 'CNAME' and r['name'] == record['name'] for r in before):
        raise RuntimeError('CNAME conflict; no existing record will be replaced')
    if existing:
        if len(existing) != 1 or existing[0]['content'] != record['content']:
            raise RuntimeError('Existing DNS differs; no existing record will be replaced')
        continue
    added.append(cf.request(f'/zones/{cf.ZONE}/dns_records', 'POST', record)['id'])
after = cf.request(f'/zones/{cf.ZONE}/dns_records?per_page=100')
(ROOT / 'dns-after.json').write_text(json.dumps(after, indent=2))
old = {r['id']: r for r in before}
current = {r['id']: r for r in after}
preserved = all(current.get(k) == v for k, v in old.items())
assert preserved, 'Existing record changed unexpectedly'
result = {'status': 'PASS', 'added_record_ids': added, 'existing_records_preserved': preserved}
(ROOT / 'dns-apply-result.json').write_text(json.dumps(result, indent=2))
print(json.dumps(result))
