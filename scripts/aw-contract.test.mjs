import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const sources = await Promise.all([
  readFile(join(root, 'SKILL.md'), 'utf8'),
  readFile(join(root, 'README.md'), 'utf8'),
  readFile(join(root, 'commands/aw.md'), 'utf8'),
  readFile(join(root, 'playbooks/fast.md'), 'utf8'),
  readFile(join(root, 'playbooks/explore.md'), 'utf8'),
  readFile(join(root, 'playbooks/implement.md'), 'utf8'),
  readFile(join(root, 'playbooks/review.md'), 'utf8'),
]);
const contract = sources.join('\n');
const lessons = await readFile(join(root, 'LESSONS.md'), 'utf8');

assert.match(contract, /graph snapshot[\s\S]*full[\s\S]*todowrite[\s\S]*before[\s\S]*dispatch/i, 'pre-dispatch graph and todo gate');
assert.match(contract, /read-only[\s\S]*aw_spawn[\s\S]*asynchronous[\s\S]*native child\s+session ID/i, 'native async read-only routing');
assert.match(contract, /aw_status[\s\S]*aw_read[\s\S]*explicit pull/i, 'explicit pull controls');
assert.match(contract, /toast[\s\S]*notification\s+only[\s\S]*does not inject/i, 'toast boundary');
assert.match(contract, /human instruction first[\s\S]*unread[\s\S]*background native jobs/i, 'new-turn ordering');
assert.match(contract, /aw_control[\s\S]*child[\s\S]*session ID is the job ID/i, 'child control identity');
assert.match(contract, /flash-explore[\s\S]*flash-review[\s\S]*read-only background/i, 'background agent restriction');
assert.match(contract, /write-capable[\s\S]*native synchronous task[\s\S]*bounded checkpoint/i, 'bounded foreground writes');
assert.match(contract, /Todo[\s\S]*main-session-owned[\s\S]*real returned session ID/i, 'todo ownership and real id');
assert.match(contract, /no fictional ID[\s\S]*pending/i, 'pending route identity');
assert.match(contract, /No T3 source patch claims[\s\S]*no automatic live panel/i, 'ui boundary');
assert.match(lessons, /synchronous task blocked advertised check-ins[\s\S]*native async read-only[\s\S]*bounded write checkpoints[\s\S]*fresh real smoke/i, 'native-session lesson');

for (const file of ['SKILL.md', 'README.md', 'commands/aw.md', 'playbooks/fast.md', 'playbooks/explore.md', 'playbooks/implement.md', 'playbooks/review.md']) {
  const text = await readFile(join(root, file), 'utf8');
  assert.doesNotMatch(text, /(?:recommend|use|run|fallback|dispatch)[^\n]*(?:opencode run|ledger|poll(?:ing)?|daemon|PID)/i, `${file}: obsolete positive runner language`);
  assert.doesNotMatch(text, /automatic[^\n]*(?:chat completion|check-in)|automatic (?:chat|status) check-in/i, `${file}: automatic check-in promise`);
}

for (const term of ['Started', 'result', 'status/read', 'session ID', 'user turn'])
  assert.match(contract, new RegExp(term, 'i'), term);
assert.match(lessons, /Date|Datum/i, 'structured lesson date');
assert.match(lessons, /Todo\/Playbook/i, 'structured lesson todo/playbook');
assert.match(lessons, /forecast vs actual\/check-in count/i, 'structured lesson forecast');
assert.match(lessons, /symptom\/evidence/i, 'structured lesson evidence');
assert.match(lessons, /root cause/i, 'structured lesson root cause');
assert.match(lessons, /orchestrator intervention/i, 'structured lesson intervention');
assert.match(lessons, /proposed skill\/playbook change/i, 'structured lesson change');
assert.match(lessons, /status: (?:pending|promoted|validated)/i, 'lesson status lifecycle');
console.log('aw transparency contract: PASS');
