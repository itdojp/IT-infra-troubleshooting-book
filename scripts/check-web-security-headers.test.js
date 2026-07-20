import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { validateWebSecurityHeaderTexts } from './check-web-security-headers.js';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

function canonicalTexts() {
  return {
    manuscript: fs.readFileSync(path.join(root, 'manuscript/appendices/c.md'), 'utf8'),
    docs: fs.readFileSync(path.join(root, 'docs/appendices/c.md'), 'utf8'),
  };
}

test('accepts synchronized Apache and Nginx CSP procedures', () => {
  const { manuscript, docs } = canonicalTexts();
  assert.deepEqual(validateWebSecurityHeaderTexts(manuscript, docs), { synchronizedSectionCount: 2 });
  assert.deepEqual(
    validateWebSecurityHeaderTexts(manuscript.replaceAll('\n', '\r\n'), docs.replaceAll('\n', '\r\n')),
    { synchronizedSectionCount: 2 },
  );
});

test('rejects X-XSS-Protection directives for Apache or Nginx', () => {
  const { manuscript, docs } = canonicalTexts();
  for (const regressed of [
    manuscript.replace(
      'Header always set X-Content-Type-Options "nosniff"',
      'Header always set X-XSS-Protection "1; mode=block"',
    ),
    manuscript.replace(
      'add_header X-Content-Type-Options "nosniff" always;',
      'add_header X-XSS-Protection "1; mode=block";',
    ),
  ]) {
    assert.throws(
      () => validateWebSecurityHeaderTexts(regressed, docs),
      /must not enable the deprecated X-XSS-Protection header/,
    );
  }
});

test('rejects unsafe-inline or unsafe-eval in an enforced CSP directive', () => {
  const { manuscript, docs } = canonicalTexts();
  for (const keyword of ["'unsafe-inline'", "'unsafe-eval'"]) {
    const regressed = docs.replace("script-src 'self'", `script-src 'self' ${keyword}`);
    assert.throws(
      () => validateWebSecurityHeaderTexts(manuscript, regressed),
      /enforced CSP example must not contain unsafe-inline or unsafe-eval/,
    );
  }
});

test('requires Report-Only rollout guidance inside the Apache section', () => {
  const { manuscript, docs } = canonicalTexts();
  const marker = 'Content-Security-Policy-Report-Only';
  const regressed = `${manuscript.replaceAll(marker, 'CSP report-only marker missing')}\n\n${marker}\n`;
  assert.throws(
    () => validateWebSecurityHeaderTexts(regressed, docs),
    /Apache CSP section is missing required web security marker.*Content-Security-Policy-Report-Only/,
  );
});

test('requires an enforced CSP in the Nginx example', () => {
  const { manuscript, docs } = canonicalTexts();
  const regressed = docs.replace('add_header Content-Security-Policy', 'add_header X-Policy-Placeholder');
  assert.throws(
    () => validateWebSecurityHeaderTexts(manuscript, regressed),
    /Nginx CSP section is missing required web security marker.*add_header Content-Security-Policy/,
  );
});

test('rejects drift between the manuscript and public Apache policy', () => {
  const { manuscript, docs } = canonicalTexts();
  const regressed = docs.replace('sudo systemctl reload httpd', 'sudo systemctl restart httpd');
  assert.throws(
    () => validateWebSecurityHeaderTexts(manuscript, regressed),
    /Apache CSP procedure differs/,
  );
});
