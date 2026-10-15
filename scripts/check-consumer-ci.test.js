import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import YAML from 'yaml';
import { validateVendoredLock, listVendoredPackages } from './check-vendored-lock.js';

const root = fileURLToPath(new URL('../', import.meta.url));
const workflow = YAML.parse(fs.readFileSync(new URL('../.github/workflows/consumer-qa.yml', import.meta.url), 'utf8'));
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
  assert.deepEqual(validateVendoredLock(lock, read, Object.keys(lock.packages).filter(key => key !== '')), []);
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
    assert.ok(validateVendoredLock(value, reader, Object.keys(value.packages).filter(key => key !== '')).length > 0);
  });
}

test('npm aliases compare the locked canonical package name', () => {
  const alias = { lockfileVersion: 3, packages: {
    'node_modules/fixture-cjs': { name: 'fixture', version: '1.0.0' } } };
  assert.deepEqual(validateVendoredLock(alias, () => ({ name: 'fixture', version: '1.0.0' }), ['node_modules/fixture-cjs']), []);
});

for (const extra of ['node_modules/extra', 'node_modules/@example/extra',
  'node_modules/fixture/node_modules/extra']) {
  test(`reject extra vendored package: ${extra}`, () => {
    const inventory = Object.keys(lock.packages).filter(key => key !== '');
    assert.ok(validateVendoredLock(lock, read, [...inventory, extra])
      .some(error => error.includes('absent from lock')));
  });
}
test('reject missing/duplicate package inventory', () => {
  assert.ok(validateVendoredLock(lock, read, undefined).length);
  assert.ok(validateVendoredLock(lock, read, []).length);
  assert.ok(validateVendoredLock(lock, read, ['duplicate', 'duplicate']).length);
});
test('inventory visits actual ordinary/scoped/nested roots and rejects links/files', () => {
  const base = fs.mkdtempSync(path.join(root, '.consumer-test-'));
  try {
    const expected = ['node_modules/plain', 'node_modules/@example/scoped',
      'node_modules/plain/node_modules/nested',
      'node_modules/plain/node_modules/@example/nested-scoped'].sort();
    const packages = {};
    for (const key of expected) {
      fs.mkdirSync(path.join(base, key), { recursive: true });
      const manifest = { name: key.split('node_modules/').at(-1), version: '1.0.0' };
      fs.writeFileSync(path.join(base, key, 'package.json'), JSON.stringify(manifest));
      packages[key] = { version: '1.0.0' };
    }
    fs.writeFileSync(path.join(base, 'package-lock.json'), JSON.stringify({ lockfileVersion: 3, packages }));
    const cli = () => spawnSync(process.execPath, [fileURLToPath(new URL('./check-vendored-lock.js', import.meta.url))],
      { cwd: base, encoding: 'utf8' });
    fs.mkdirSync(path.join(base, 'node_modules/.bin'));
    fs.writeFileSync(path.join(base, 'node_modules/.package-lock.json'), '{}');
    assert.deepEqual(listVendoredPackages(base), expected);
    assert.equal(cli().status, 0);
    const extra = path.join(base, 'node_modules/extra');
    fs.mkdirSync(extra);
    assert.ok(listVendoredPackages(base).includes('node_modules/extra'));
    assert.equal(cli().status, 1);
    fs.rmdirSync(extra);
    fs.symlinkSync(path.join(base, 'node_modules/plain'), extra, 'dir');
    assert.throws(() => listVendoredPackages(base), /not a link/);
    fs.unlinkSync(extra);
    const dangling = path.join(base, 'node_modules/@example/scoped/node_modules');
    fs.symlinkSync(path.join(base, 'absent'), dangling, 'dir');
    assert.throws(() => listVendoredPackages(base), /not a link/);
    assert.equal(cli().status, 1);
    fs.unlinkSync(dangling);
    fs.writeFileSync(extra, 'not a package directory');
    assert.throws(() => listVendoredPackages(base), /not a link\/file/);
  } finally { fs.rmSync(base, { recursive: true, force: true }); }
});
