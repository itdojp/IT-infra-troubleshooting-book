import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import YAML from 'yaml';

import { validateNetworkConfigTexts } from './check-network-config-modernization.js';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

function canonicalTexts() {
  return {
    manuscript: fs.readFileSync(path.join(root, 'manuscript/appendices/c.md'), 'utf8'),
    docs: fs.readFileSync(path.join(root, 'docs/appendices/c.md'), 'utf8'),
  };
}

function netplanDocument(text) {
  const section = text.match(
    /#### \/etc\/netplan\/\*\.yaml の例（Ubuntu \/ Netplan）[\s\S]*?```yaml\r?\n([\s\S]*?)\r?\n```/,
  );
  assert.ok(section, 'Netplan YAML block must exist');
  return YAML.parse(section[1]);
}

test('accepts current RHEL 9 and Netplan procedures with source/public parity', () => {
  const { manuscript, docs } = canonicalTexts();
  assert.deepEqual(validateNetworkConfigTexts(manuscript, docs), { synchronizedSectionCount: 4 });
  assert.deepEqual(
    validateNetworkConfigTexts(manuscript.replaceAll('\n', '\r\n'), docs.replaceAll('\n', '\r\n')),
    { synchronizedSectionCount: 4 },
  );
});

test('parses the canonical Netplan example with an explicit default route', () => {
  const { manuscript, docs } = canonicalTexts();
  for (const text of [manuscript, docs, manuscript.replaceAll('\n', '\r\n'), docs.replaceAll('\n', '\r\n')]) {
    const config = netplanDocument(text);
    assert.deepEqual(config.network.ethernets.enp1s0.routes, [
      { to: 'default', via: '192.0.2.1' },
    ]);
    assert.equal('gateway4' in config.network.ethernets.enp1s0, false);
  }
});

test('rejects a gateway4 regression in either canonical copy', () => {
  const { manuscript, docs } = canonicalTexts();
  const routeBlock = '      routes:\n        - to: default\n          via: 192.0.2.1';
  const gateway4 = '      gateway4: 192.0.2.1';
  for (const [source, publicCopy] of [
    [manuscript.replace(routeBlock, gateway4), docs],
    [manuscript, docs.replace(routeBlock, gateway4)],
  ]) {
    assert.throws(
      () => validateNetworkConfigTexts(source, publicCopy),
      /deprecated gateway4\/gateway6 key/,
    );
  }
});

test('rejects removal of the ifcfg migration command', () => {
  const { manuscript, docs } = canonicalTexts();
  const regressed = docs.replace(
    'sudo nmcli connection migrate "<connection-name-or-UUID>"',
    'echo migration-command-missing',
  );
  assert.throws(
    () => validateNetworkConfigTexts(manuscript, regressed),
    /missing required marker.*nmcli connection migrate/,
  );
});

test('rejects an unlabeled ifcfg procedure', () => {
  const { manuscript, docs } = canonicalTexts();
  const regressed = manuscript.replace(
    '#### Legacy: ifcfg-*（RHEL 8 / RHEL 9既存環境の移行対象）',
    '#### /etc/sysconfig/network-scripts/ifcfg-eth0',
  );
  assert.throws(
    () => validateNetworkConfigTexts(regressed, docs),
    /ifcfg must not be presented as an unlabeled current procedure/,
  );
});

test('rejects drift between the manuscript and public RHEL procedure', () => {
  const { manuscript, docs } = canonicalTexts();
  const regressed = docs.replace('con-name static-enp1s0', 'con-name public-only-profile');
  assert.throws(
    () => validateNetworkConfigTexts(manuscript, regressed),
    /RHEL 9 NetworkManager primary procedure differs/,
  );
});
