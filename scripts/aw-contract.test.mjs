import assert from 'node:assert/strict';
import { access, readFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

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
const core = await readFile(join(root, 'plugin/aw-supervisor-core.js'), 'utf8');
const hostConfig = process.env.AW_OPENCODE_CONFIG ?? '/Users/henrikholkenbrink/.config/opencode/opencode.json';

function assertCanonicalFrontmatter(text, name) {
  const match = text.match(/^---\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)/);
  assert.ok(match, `${name}: canonical frontmatter delimiters`);
  const body = match[1];
  try {
    const require = createRequire(import.meta.url);
    require('yaml').parse(body);
  } catch (error) {
    if (error?.code !== 'MODULE_NOT_FOUND') throw new Error(`${name}: invalid YAML: ${error.message}`);
    const lines = body.split(/\r?\n/);
    const bash = lines.indexOf('  bash:');
    if (bash === -1) return;
    for (const line of lines.slice(bash + 1)) {
      if (!/^    (?:"[^"]+"|\*): (?:allow|deny)$/.test(line)) break;
      assert.equal(line.match(/^\s*/)[0].length, 4, `${name}: bash key indentation`);
    }
  }
  const lines = body.split(/\r?\n/);
  const bash = lines.indexOf('  bash:');
  if (bash === -1) return;
  let count = 0;
  for (const line of lines.slice(bash + 1)) {
    if (!line.trim()) continue;
    if (!/^    (?:"[^"]+"|\*): (?:allow|deny)$/.test(line)) break;
    count++;
  }
  assert.ok(count > 0, `${name}: bash entries have canonical indentation`);
}

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
assert.match(contract, /## Parallel progress[\s\S]*optional[\s\S]*smallest useful fan-out[\s\S]*overlapping writes[\s\S]*reconcile[\s\S]*final verification/i, 'soft parallel progress contract');
assert.match(contract, /native `aw_spawn` remains stable[\s\S]*background=true[\s\S]*experimental support[\s\S]*not required/i, 'native spawn remains stable');
assert.doesNotMatch(contract, /always parallel|must parallel|parallelize everything|fixed agent count/i, 'parallel guidance is non-binding');
for (const file of ['aw-luna-worker.md', 'aw-luna-review.md', 'aw-orchestrator.md', 'aw-sol-expert.md']) {
  const profile = await readFile(join(root, 'agents/opencode', file), 'utf8');
  assert.match(profile, /^---\n[\s\S]*\n---/m, `${file}: frontmatter`);
}
const profiles = await Promise.all(['aw-luna-worker.md', 'aw-luna-review.md', 'aw-sol-expert.md', 'aw-orchestrator.md'].map(file => readFile(join(root, 'agents/opencode', file), 'utf8')));
for (const [index, profile] of profiles.entries())
  assertCanonicalFrontmatter(profile, ['aw-luna-worker.md', 'aw-luna-review.md', 'aw-sol-expert.md', 'aw-orchestrator.md'][index]);
assert.match(profiles[0], /model: venice\/openai-gpt-56-luna[\s\S]*mode: subagent[\s\S]*permission:/);
assert.match(profiles[1], /model: venice\/openai-gpt-56-luna[\s\S]*mode: subagent[\s\S]*permission:/);
assert.match(profiles[2], /model: venice\/openai-gpt-56-sol[\s\S]*mode: subagent[\s\S]*permission:/);
assert.match(profiles[3], /mode: primary[\s\S]*permission:/);
for (const profile of profiles) { assert.doesNotMatch(profile, /^role:/m); assert.doesNotMatch(profile, /^permissions:/m); }
assert.match(profiles[0], /edit: allow[\s\S]*task:[\s\S]*"\*": deny[\s\S]*aw-luna-review[\s\S]*aw-sol-expert/, 'worker is write-capable and task deny-first');
assert.match(profiles[3], /edit: allow[\s\S]*task: allow/, 'orchestrator is write-capable');
for (const [name, profile] of [['reviewer', profiles[1]]]) {
  assert.match(profile, /edit: deny/, `${name}: edit denied`);
  assert.match(profile, /write: deny/, `${name}: write denied`);
  assert.match(profile, /task: deny/, `${name}: task denied`);
  assert.match(profile, /bash:\s+[\s\S]*"\*": deny[\s\S]*"rm \*": deny[\s\S]*"git reset\*": deny/, `${name}: destructive bash denied`);
}
assert.match(profiles[2], /task: deny[\s\S]*edit: allow[\s\S]*write: allow/, 'Sol is gated contributor');
const solYaml = await readFile(join(root, 'agents/opencode/aw-sol-expert.yaml'), 'utf8');
for (const key of ['edit: allow', 'write: allow', 'task: deny', '"*": deny', '"rm *": deny', '"git reset*": deny'])
  assert.match(solYaml, new RegExp(key.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')), `Sol YAML: ${key}`);
const solMarkdown = await readFile(join(root, 'agents/opencode/aw-sol-expert.md'), 'utf8');
for (const key of ['deploy*', 'npm run deploy*', 'pnpm run deploy*']) {
  assert.match(solYaml, new RegExp(`"${key.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}": deny`), `Sol YAML deploy deny: ${key}`);
  assert.match(solMarkdown, new RegExp(`"${key.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}": deny`), `Sol Markdown deploy deny: ${key}`);
}
assert.ok(supervisor.includes('tool.execute.before') && supervisor.includes('tool.execute.after'), 'tool hooks');
assert.match(supervisor, /aw_checkpoint/);
assert.doesNotMatch(supervisor, /__testing/);
assert.match(supervisor, /input_sig/);
assert.match(supervisor, /output\?\.args \?\? input\?\.args/);
assert.match(supervisor, /suggestion/); assert.doesNotMatch(supervisor, /decision: result\.decision/);
assert.match(core, /isVerificationCommand|verificationEvidence/);
assert.match(supervisor, /file\\?\.edited[\s\S]*session\\?\.diff/, 'file/session sensors');
assert.match(supervisor, /lsp\\?\.client\\?\.diagnostics[\s\S]*lsp\\?\.updated/, 'LSP sensors');
assert.match(supervisor, /permission.*asked.*replied/s, 'permission sensors');
assert.match(supervisor, /session.*idle.*error.*compacted/s, 'lifecycle sensors');
assert.ok(supervisor.includes('Host decides any control action'), 'host decision boundary');
const hasExplicitConfig = Boolean(process.env.AW_OPENCODE_CONFIG);
try {
  await access(hostConfig);
  const activeConfig = JSON.parse(await readFile(hostConfig, 'utf8'));
  assert.equal(activeConfig.subagent_depth, 2, 'active subagent depth');
  assert.ok(activeConfig.plugin?.includes('file:///Users/henrikholkenbrink/.config/opencode/skills/aw/plugin/aw-native.js'), 'active native registration');
  assert.ok(activeConfig.plugin?.includes('file:///Users/henrikholkenbrink/.config/opencode/skills/aw/plugin/aw-supervisor.js'), 'active supervisor registration');
  const activeAgents = activeConfig.agent ?? {};
  const safeBash = new Set(['pwd', 'ls *', 'git status*', 'git diff*', 'git log*', 'grep *', 'rg *']);
   const verification = new Set(['npm test*', 'npm run test*', 'npm run lint*', 'npm run typecheck*', 'npm run build*', 'pnpm test*', 'pnpm run test*', 'pnpm run lint*', 'pnpm run typecheck*', 'pnpm run build*', 'pytest*', 'go test*', 'cargo test*']);
   const mutationDenies = new Set(['rm *', 'rm -rf *', 'git reset*', 'git clean*', 'git checkout*', 'git restore*', 'git commit*', 'git push*', 'git apply*', 'mv *', 'cp *', '* > *', '* >> *', 'sh *', 'bash *', 'zsh *', 'node *', 'python *', 'perl *', 'ruby *', 'source *', 'eval *', 'deploy *', 'release*', 'npm run release*', 'pnpm run release*', 'npm publish*', 'pnpm publish*', 'npm run deploy*', 'pnpm run deploy*']);
  for (const name of ['flash-review', 'aw-sol-expert']) {
    const profile = activeAgents[name];
    assert.ok(profile, `${name}: active profile present`);
    assert.equal(profile.permission?.edit, name === 'aw-sol-expert' ? 'allow' : 'deny', `${name}: active edit matrix`);
    assert.equal(profile.permission?.write, name === 'aw-sol-expert' ? 'allow' : 'deny', `${name}: active write matrix`);
    assert.equal(profile.permission?.task, 'deny', `${name}: active task denied`);
    const bash = profile.permission?.bash ?? {};
    assert.equal(Object.keys(bash)[0], '*', `${name}: bash wildcard deny precedes allows`);
    assert.equal(bash['*'], 'deny', `${name}: bash wildcard denied`);
    for (const [pattern, decision] of Object.entries(bash)) {
      if (pattern === '*') continue;
        if (safeBash.has(pattern) || verification.has(pattern)) assert.equal(decision, 'allow', `${name}: safe bash allowlist`);
       else assert.equal(decision, 'deny', `${name}: non-safe bash vector denied: ${pattern}`);
       if (mutationDenies.has(pattern)) assert.equal(decision, 'deny', `${name}: mutation deny`);
        if (name === 'aw-sol-expert') assert.ok(mutationDenies.has(pattern) || safeBash.has(pattern) || verification.has(pattern) || pattern === '*', `${name}: exact effective matrix: ${pattern}`);
    }
  }
   for (const pattern of ['release*', 'npm run release*', 'pnpm run release*'])
     assert.equal(activeAgents['aw-sol-expert'].permission?.bash?.[pattern], 'deny', `aw-sol-expert: active release deny: ${pattern}`);
   const worker = activeAgents['flash-worker'];
  assert.ok(worker, 'flash-worker: active profile present');
  assert.equal(worker.permission?.edit, 'allow', 'flash-worker: edit allowed');
  assert.equal(worker.permission?.write, 'allow', 'flash-worker: write allowed');
   assert.deepEqual(worker.permission?.task, {'*': 'deny', 'aw-luna-review': 'allow', 'aw-sol-expert': 'allow'}, 'flash-worker: deny-first task matrix');
  const orchestrator = activeAgents['aw-orchestrator'];
  assert.ok(orchestrator, 'aw-orchestrator: active profile present');
  assert.equal(orchestrator.mode, 'primary', 'aw-orchestrator: primary mode');
  assert.equal(orchestrator.model, undefined, 'aw-orchestrator: host-configurable model');
  assert.deepEqual(Object.keys(orchestrator.permission ?? {}), ['edit', 'write', 'task'], 'aw-orchestrator: exact permission matrix');
} catch (error) {
  if (hasExplicitConfig || error?.code !== 'ENOENT') throw error;
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
