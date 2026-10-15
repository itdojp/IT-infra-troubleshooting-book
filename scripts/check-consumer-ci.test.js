import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';
import YAML from 'yaml';
import { validateVendoredLock } from './check-vendored-lock.js';

const workflow = YAML.parse(fs.readFileSync('.github/workflows/consumer-qa.yml', 'utf8'));
function checkWorkflow(value) {
  assert.ok(Object.hasOwn(value.on, 'pull_request'));
  assert.equal(value.on.pull_request, null);
  assert.deepEqual(value.on.push, { branches: ['main'] });
  assert.deepEqual(value.permissions, { contents: 'read' });
  const job = value.jobs['consumer-qa'];
  assert.equal(job.name, 'consumer-qa');
  assert.equal(job.if, undefined);
  assert.equal(job['continue-on-error'], undefined);
  assert.equal(job.defaults, undefined);
  assert.equal(value.defaults, undefined);
  const setup = job.steps.find(step => step.uses === 'actions/setup-node@v6');
  assert.equal(setup.with['node-version'], '20');
  assert.equal(setup.with['cache-dependency-path'], 'package-lock.json');
  for (const step of job.steps) {
    assert.equal(step.if, undefined);
    assert.equal(step['continue-on-error'], undefined);
    assert.equal(step['working-directory'], undefined);
  }
  assert.deepEqual(job.steps.filter(step => step.run).map(step => step.run), [
    'node scripts/check-vendored-lock.js',
    'npm ci --ignore-scripts --include=dev',
    'npm audit --audit-level=high --include=dev',
    'npm test', 'npm run lint', 'npm run check-links',
  ]);
}

test('consumer stable CI checks PR/main, before-install vendor, full root audit/tests', () => {
  checkWorkflow(workflow);
});
const mutations = [
  value => { delete value.on.pull_request; },
  value => { value.on.pull_request = { paths: ['docs/**'] }; },
  value => { value.on.push.branches = ['other']; },
  value => { value.jobs['consumer-qa'].if = 'false'; },
  value => { value.jobs['consumer-qa']['continue-on-error'] = true; },
  value => { value.jobs['consumer-qa'].steps[4]['continue-on-error'] = true; },
  value => { value.jobs['consumer-qa'].steps[4].if = 'false'; },
  value => { value.jobs['consumer-qa'].steps[4]['working-directory'] = 'book-formatter'; },
  value => { value.jobs['consumer-qa'].steps[4].run = 'npm audit --audit-level=critical'; },
  value => { value.jobs['consumer-qa'].steps[4].run += ' || true'; },
  value => { value.jobs['consumer-qa'].steps[3].run = 'npm ci'; },
  value => { value.jobs['consumer-qa'].steps.splice(5, 1); },
  value => { value.jobs['consumer-qa'].steps.splice(2, 1); },
  value => { value.jobs['consumer-qa'].steps.reverse(); },
];
for (const [index, mutate] of mutations.entries()) {
  test(`reject consumer CI weakening ${index + 1}`, () => {
    const changed = structuredClone(workflow); mutate(changed);
    assert.throws(() => checkWorkflow(changed));
  });
}
const lock = { lockfileVersion: 3, packages: { '': {},
  'node_modules/fixture': { version: '1.0.0' },
  'node_modules/fixture/node_modules/@example/nested': { version: '2.0.0' } } };
const read = key => ({ name: key.split('node_modules/').at(-1), version: lock.packages[key].version });
test('vendor identities/versions pass including nested scoped packages', () => {
  assert.deepEqual(validateVendoredLock(lock, read), []);
});
for (const [label, value, reader] of [
  ['stale version', lock, key => ({ ...read(key), version: '0.0.1' })],
  ['wrong identity', lock, key => ({ ...read(key), name: 'wrong' })],
  ['missing manifest', lock, () => { throw new Error('missing'); }],
  ['missing version', { lockfileVersion: 3, packages: { 'node_modules/fixture': {} } }, read],
  ['wrong schema', { ...lock, lockfileVersion: 2 }, read],
  ['empty graph', { lockfileVersion: 3, packages: { '': {} } }, read],
  ['traversal', { lockfileVersion: 3, packages: { 'node_modules/../../fixture': { version: '1' } } }, read],
]) {
  test(`reject vendored ${label}`, () => {
    assert.ok(validateVendoredLock(value, reader).length > 0);
  });
}

test('npm aliases compare the locked canonical package name', () => {
  const alias = { lockfileVersion: 3, packages: {
    'node_modules/fixture-cjs': { name: 'fixture', version: '1.0.0' } } };
  assert.deepEqual(validateVendoredLock(alias, () => ({ name: 'fixture', version: '1.0.0' })), []);
});
