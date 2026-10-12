"""Verify the saved public DirectMail records at authoritative and public DNS.
Run: python3 artifacts/directmail-20261012/verify-dns.py
Requires dig and dns-desired.json; writes public DNS answers only.
"""
import concurrent.futures
import json
from pathlib import Path
import shlex
import subprocess

ROOT = Path(__file__).resolve().parent
desired = json.loads((ROOT / 'dns-desired.json').read_text())
resolvers = ['gerardo.ns.cloudflare.com', '1.1.1.1', '8.8.8.8']

def verify(item):
    resolver, record = item
    process = subprocess.run(
        ['dig', f'@{resolver}', record['name'], record['type'], '+short', '+time=3', '+tries=1'],
        capture_output=True, text=True, timeout=12,
    )
    lines = process.stdout.strip().splitlines()
    values = [''.join(shlex.split(line)) if record['type'] == 'TXT' else line.rstrip('.') for line in lines]
    expected = record['content'] if record['type'] == 'TXT' else f"{record['priority']} {record['content']}"
    return {
        'resolver': resolver, 'type': record['type'], 'name': record['name'],
        'answers': values, 'status': 'PASS' if process.returncode == 0 and expected in values else 'FAIL',
    }

with concurrent.futures.ThreadPoolExecutor(max_workers=6) as pool:
    checks = list(pool.map(verify, [(s, r) for s in resolvers for r in desired]))
report = {'status': 'PASS' if all(c['status'] == 'PASS' for c in checks) else 'FAIL', 'checks': checks}
(ROOT / 'dns-verification.json').write_text(json.dumps(report, indent=2))
print(json.dumps({'status': report['status'], 'passed': sum(c['status'] == 'PASS' for c in checks), 'total': len(checks)}))
raise SystemExit(0 if report['status'] == 'PASS' else 1)
