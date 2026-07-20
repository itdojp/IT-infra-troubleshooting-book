import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { validateMysqlBinlogTexts } from './check-mysql-binlog-modernization.js';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

function canonicalTexts() {
  return {
    manuscript: fs.readFileSync(path.join(root, 'manuscript/appendices/c.md'), 'utf8'),
    docs: fs.readFileSync(path.join(root, 'docs/appendices/c.md'), 'utf8'),
  };
}

test('accepts the Oracle MySQL 8.0.34 baseline with source/public parity', () => {
  const { manuscript, docs } = canonicalTexts();
  assert.deepEqual(validateMysqlBinlogTexts(manuscript, docs), { synchronizedSectionCount: 1 });
  assert.deepEqual(
    validateMysqlBinlogTexts(manuscript.replaceAll('\n', '\r\n'), docs.replaceAll('\n', '\r\n')),
    { synchronizedSectionCount: 1 },
  );
});

test('rejects expire_logs_days assignments in either canonical copy', () => {
  const { manuscript, docs } = canonicalTexts();
  for (const [source, publicCopy] of [
    [manuscript.replace('binlog_expire_logs_seconds = 604800', 'expire_logs_days = 7'), docs],
    [manuscript, docs.replace('binlog_expire_logs_seconds = 604800', 'expire_logs_days = 7')],
  ]) {
    assert.throws(
      () => validateMysqlBinlogTexts(source, publicCopy),
      /deprecated MySQL binary log assignment/,
    );
  }
});

test('rejects an explicit deprecated binlog_format assignment', () => {
  const { manuscript, docs } = canonicalTexts();
  const regressed = docs.replace('log-bin = mysql-bin', 'log-bin = mysql-bin\nbinlog_format = ROW');
  assert.throws(
    () => validateMysqlBinlogTexts(manuscript, regressed),
    /deprecated MySQL binary log assignment/,
  );
});

test('rejects loss of the MariaDB product and version boundary', () => {
  const { manuscript, docs } = canonicalTexts();
  const regressed = manuscript.replace('MariaDB 10.6.1以降', 'MariaDB version unspecified');
  assert.throws(
    () => validateMysqlBinlogTexts(regressed, docs),
    /missing required MySQL binary log marker.*MariaDB 10\.6\.1/,
  );
});

test('rejects removal of the non-deprecated verification variable', () => {
  const { manuscript, docs } = canonicalTexts();
  const regressed = docs.replace(
    '@@global.binlog_expire_logs_seconds AS retention_seconds',
    '604800 AS retention_seconds',
  );
  assert.throws(
    () => validateMysqlBinlogTexts(manuscript, regressed),
    /missing required MySQL binary log marker.*@@global\.binlog_expire_logs_seconds/,
  );
});

test('rejects drift between the manuscript and public retention example', () => {
  const { manuscript, docs } = canonicalTexts();
  const regressed = docs.replace('例として7日（604800秒）', '例として14日（1209600秒）');
  assert.throws(
    () => validateMysqlBinlogTexts(manuscript, regressed),
    /MySQL 8\.0\.34 binary log section differs/,
  );
});
