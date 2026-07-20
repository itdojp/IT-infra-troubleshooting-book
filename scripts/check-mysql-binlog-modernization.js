#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export class MysqlBinlogContractError extends Error {}

const appendixPaths = {
  manuscript: 'manuscript/appendices/c.md',
  docs: 'docs/appendices/c.md',
};

const section = {
  start: '#### Binary log設定（Oracle MySQL 8.0.34以降）',
  end: '### PostgreSQL',
};

const requiredMarkers = [
  'Oracle MySQL 8.0.34以降の新規installation',
  'MySQL 8.0ではbinary logとROW formatがdefault',
  'binlog_expire_logs_auto_purge = ON',
  'binlog_expire_logs_seconds = 604800',
  '最大replica lagに運用余裕を加えた期間',
  'point-in-time recoveryとbackup policy',
  'deprecated変数を参照せず',
  '@@global.binlog_expire_logs_auto_purge',
  '@@global.binlog_expire_logs_seconds',
  '既存のSTATEMENT/MIXED環境',
  'MariaDBは別製品',
  'MariaDB 10.6.1以降',
  'https://dev.mysql.com/doc/refman/8.0/en/replication-options-binary-log.html',
  'https://dev.mysql.com/doc/relnotes/mysql/8.0/en/news-8-0-34.html',
  'https://dev.mysql.com/doc/refman/8.0/en/replication-formats.html',
  'https://mariadb.com/docs/server/ha-and-performance/standard-replication/replication-and-binary-log-system-variables',
];

const deprecatedAssignments = /^\s*(?:expire_logs_days|binlog[-_]format)\s*=/im;

function readRequired(root, relativePath) {
  try {
    return fs.readFileSync(path.join(root, relativePath), 'utf8');
  } catch (error) {
    throw new MysqlBinlogContractError(
      `MySQL binary log contract could not read ${relativePath}: ${error instanceof Error ? error.message : String(error)}`,
    );
  }
}

function extractSection(text, label) {
  const start = text.indexOf(section.start);
  if (start < 0) {
    throw new MysqlBinlogContractError(`${label} appendix C is missing the MySQL 8.0.34 binary log section`);
  }
  const end = text.indexOf(section.end, start + section.start.length);
  if (end < 0) {
    throw new MysqlBinlogContractError(`${label} appendix C is missing the PostgreSQL boundary`);
  }
  return text.slice(start, end).trim();
}

export function validateMysqlBinlogTexts(manuscript, docs) {
  const sections = {};
  for (const [label, text] of Object.entries({ manuscript, docs })) {
    if (deprecatedAssignments.test(text)) {
      throw new MysqlBinlogContractError(
        `${label} appendix C contains a deprecated MySQL binary log assignment`,
      );
    }
    for (const marker of requiredMarkers) {
      if (!text.includes(marker)) {
        throw new MysqlBinlogContractError(
          `${label} appendix C is missing required MySQL binary log marker ${JSON.stringify(marker)}`,
        );
      }
    }
    sections[label] = extractSection(text, label);
  }

  if (sections.manuscript !== sections.docs) {
    throw new MysqlBinlogContractError(
      'MySQL 8.0.34 binary log section differs between manuscript/appendices/c.md and docs/appendices/c.md',
    );
  }

  return { synchronizedSectionCount: 1 };
}

export function validateMysqlBinlogModernization(
  root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..'),
) {
  return validateMysqlBinlogTexts(
    readRequired(root, appendixPaths.manuscript),
    readRequired(root, appendixPaths.docs),
  );
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    const result = validateMysqlBinlogModernization();
    console.log(
      `OK: MySQL binary log parameters are current and synchronized (${result.synchronizedSectionCount} section)`,
    );
  } catch (error) {
    console.error(`ERROR: ${error instanceof Error ? error.message : String(error)}`);
    process.exit(1);
  }
}
