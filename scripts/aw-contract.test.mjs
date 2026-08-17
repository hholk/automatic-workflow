import assert from 'node:assert/strict';
import { access, readFile } from 'node:fs/promises';
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
  readFile(join(root, 'playbooks/fix.md'), 'utf8'),
]);
const contract = sources.join('\n');
const lessons = await readFile(join(root, 'LESSONS.md'), 'utf8');
const supervisor = await readFile(join(root, 'plugin/aw-supervisor.js'), 'utf8');
const hostConfig = process.env.AW_OPENCODE_CONFIG ?? '/Users/henrikholkenbrink/.config/opencode/opencode.json';

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
assert.doesNotMatch(sources.at(-1), /mechanical\s+two[- ]fail/i, 'fix playbook has no mechanical two-fail gate');
for (const hook of ['tool.execute.before', 'tool.execute.after', 'session.diff', 'lsp.client.diagnostics', 'experimental.session.compacting'])
  assert.ok(supervisor.includes(hook) || supervisor.includes(hook.replaceAll('.', '\\.')), `${hook}: documented supervisor hook`);
assert.match(contract, /sensor layer[\s\S]*host[^\n]*decid/i, 'sensor and host decision boundaries');
assert.match(contract, /action[- ]risk[\s\S]*reasoning[- ]risk/i, 'action-risk versus reasoning-risk distinction');
assert.match(contract, /exactly three numbered next steps/i, 'three-option closure contract');
for (const file of ['aw-luna-worker.md', 'aw-luna-review.md', 'aw-orchestrator.md', 'aw-sol-expert.md']) {
  const profile = await readFile(join(root, 'agents/opencode', file), 'utf8');
  assert.match(profile, /^---\n[\s\S]*\n---/m, `${file}: frontmatter`);
}
assert.ok(supervisor.includes('tool.execute.before') && supervisor.includes('tool.execute.after'), 'tool hooks');
assert.match(supervisor, /file\\?\.edited[\s\S]*session\\?\.diff/, 'file/session sensors');
assert.match(supervisor, /lsp\\?\.client\\?\.diagnostics[\s\S]*lsp\\?\.updated/, 'LSP sensors');
assert.match(supervisor, /permission.*asked.*replied/s, 'permission sensors');
assert.match(supervisor, /session.*idle.*error.*compacted/s, 'lifecycle sensors');
assert.ok(supervisor.includes('Host decides any control action'), 'host decision boundary');
try {
  await access(hostConfig);
  const activeConfig = JSON.parse(await readFile(hostConfig, 'utf8'));
  assert.ok(activeConfig.plugin?.includes('file:///Users/henrikholkenbrink/.config/opencode/skills/aw/plugin/aw-native.js'), 'active native registration');
  assert.ok(activeConfig.plugin?.includes('file:///Users/henrikholkenbrink/.config/opencode/skills/aw/plugin/aw-supervisor.js'), 'active supervisor registration');
} catch (error) {
  if (process.env.AW_OPENCODE_CONFIG) throw error;
}

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
