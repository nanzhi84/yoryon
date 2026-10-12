/** Harmless status commands prove queued callers allocate at most one bounded container. */
import fs from 'node:fs/promises';
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
const exec=promisify(execFile);
const command=String.raw`set -e
sudo /opt/yoryon/blog cache status >/dev/null 2>&1 & first=$!
sudo /opt/yoryon/blog cache status >/dev/null 2>&1 & second=$!
for i in $(seq 1 120); do
  count=$(sudo docker ps --filter label=com.docker.compose.project=yoryon --filter label=com.docker.compose.service=cli --format '{{.ID}}' | wc -l)
  echo "count=$count"
  sudo docker inspect yoryon-cli-run --format 'limit={{.HostConfig.Memory}},cpu={{.HostConfig.NanoCpus}},pids={{.HostConfig.PidsLimit}}' 2>/dev/null || true
  if ! kill -0 "$first" 2>/dev/null && ! kill -0 "$second" 2>/dev/null; then break; fi
  sleep 0.25
done
wait "$first"
wait "$second"
curl --fail --silent http://localhost:80/health >/dev/null 2>&1 || true
`;
const {stdout}=await exec('ssh',['-o','BatchMode=yes','-o','ConnectTimeout=10','admin@8.222.152.17',command],{timeout:90000,maxBuffer:1024*1024});
const counts=[...stdout.matchAll(/count=\s*(\d+)/g)].map(m=>Number(m[1]));
const limits=[...stdout.matchAll(/limit=(\d+),cpu=(\d+),pids=(\d+)/g)].map(m=>m.slice(1).map(Number));
const res=await fetch('https://api.yoryon.com/health',{signal:AbortSignal.timeout(10000)});
const report={command:'node deploy/verify-cli-resources.mjs',environment:'production host; two concurrent cache status callers; no data mutation',at:new Date().toISOString(),checks:{bothCommandsSucceeded:true,onlyOneContainer:counts.length>0&&Math.max(...counts)===1,resourceLimits:limits.length>0&&limits.every(x=>x[0]===268435456&&x[1]===500000000&&x[2]===64),apiHealthy:res.ok},samples:counts.length,maximumCliContainers:Math.max(...counts)};
await fs.writeFile(new URL('../artifacts/performance-20261012/recovery/cli-queue-proof.json',import.meta.url),JSON.stringify(report,null,2));
console.log(JSON.stringify(report));if(!Object.values(report.checks).every(Boolean))process.exitCode=1;
