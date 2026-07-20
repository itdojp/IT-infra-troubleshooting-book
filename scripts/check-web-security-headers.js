#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export class WebSecurityHeaderContractError extends Error {}

const appendixPaths = {
  manuscript: 'manuscript/appendices/c.md',
  docs: 'docs/appendices/c.md',
};

const sections = [
  {
    name: 'Apache CSP procedure',
    start: '#### /etc/httpd/conf/httpd.conf (基本設定)',
    end: '### Nginx',
  },
  {
    name: 'Nginx CSP procedure',
    start: '#### /etc/nginx/nginx.conf',
    end: '#### /etc/nginx/conf.d/example.conf',
  },
];

const apacheMarkers = [
  '<IfModule mod_headers.c>',
  'Header always set Content-Security-Policy',
  "default-src 'self'; script-src 'self'; style-src 'self'; object-src 'none'; base-uri 'self'; frame-ancestors 'none'; form-action 'self'",
  '`X-XSS-Protection`はnon-standardかつdeprecated',
  'CSPをXSSのdefense-in-depth',
  'context-awareなoutput encoding',
  'untrusted HTMLのsanitization',
  'Content-Security-Policy-Report-Only',
  'Reporting-Endpoints',
  '`report-to`',
  "`'unsafe-inline'`や`'unsafe-eval'`で緩和せず",
  'responseごとのnonce',
  'content hash',
  'sudo apachectl configtest',
  'https://developer.mozilla.org/ja/docs/Web/HTTP/Reference/Headers/X-XSS-Protection',
  'https://developer.mozilla.org/en-US/docs/Web/HTTP/Guides/CSP',
  'https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Headers/Content-Security-Policy-Report-Only',
  'https://httpd.apache.org/docs/2.4/mod/mod_headers.html',
];

const nginxMarkers = [
  'add_header Content-Security-Policy',
  'form-action \'self\'" always;',
  '下位の`server` / `location`に別の`add_header`があると上位設定を通常継承しません',
  '`nginx -t`',
  'https://nginx.org/en/docs/http/ngx_http_headers_module.html',
];

const forbiddenDirectivePatterns = [
  {
    pattern: /^\s*Header\s+(?:always\s+)?set\s+X-XSS-Protection\b/im,
    message: 'Apache must not enable the deprecated X-XSS-Protection header',
  },
  {
    pattern: /^\s*add_header\s+X-XSS-Protection\b/im,
    message: 'Nginx must not enable the deprecated X-XSS-Protection header',
  },
  {
    pattern: /^\s*(?:Header\s+(?:always\s+)?set|add_header)\s+Content-Security-Policy[^\n]*(?:'unsafe-inline'|'unsafe-eval')/im,
    message: 'the enforced CSP example must not contain unsafe-inline or unsafe-eval',
  },
];

function readRequired(root, relativePath) {
  try {
    return fs.readFileSync(path.join(root, relativePath), 'utf8');
  } catch (error) {
    throw new WebSecurityHeaderContractError(
      `web security header contract could not read ${relativePath}: ${error instanceof Error ? error.message : String(error)}`,
    );
  }
}

function extractSection(text, section, label) {
  const start = text.indexOf(section.start);
  if (start < 0) {
    throw new WebSecurityHeaderContractError(`${label} is missing ${section.name} start marker`);
  }
  const end = text.indexOf(section.end, start + section.start.length);
  if (end < 0) {
    throw new WebSecurityHeaderContractError(`${label} is missing ${section.name} end marker`);
  }
  return text.slice(start, end).trim();
}

function requireMarkers(text, markers, label) {
  for (const marker of markers) {
    if (!text.includes(marker)) {
      throw new WebSecurityHeaderContractError(
        `${label} is missing required web security marker ${JSON.stringify(marker)}`,
      );
    }
  }
}

export function validateWebSecurityHeaderTexts(manuscript, docs) {
  const extracted = {};
  for (const [label, text] of Object.entries({ manuscript, docs })) {
    for (const { pattern, message } of forbiddenDirectivePatterns) {
      if (pattern.test(text)) {
        throw new WebSecurityHeaderContractError(`${label} appendix C: ${message}`);
      }
    }

    const apache = extractSection(text, sections[0], label);
    const nginx = extractSection(text, sections[1], label);
    requireMarkers(apache, apacheMarkers, `${label} Apache CSP section`);
    requireMarkers(nginx, nginxMarkers, `${label} Nginx CSP section`);
    extracted[label] = { apache, nginx };
  }

  for (const { name } of sections) {
    const key = name.startsWith('Apache') ? 'apache' : 'nginx';
    if (extracted.manuscript[key] !== extracted.docs[key]) {
      throw new WebSecurityHeaderContractError(
        `${name} differs between manuscript/appendices/c.md and docs/appendices/c.md`,
      );
    }
  }

  return { synchronizedSectionCount: sections.length };
}

export function validateWebSecurityHeaders(
  root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..'),
) {
  return validateWebSecurityHeaderTexts(
    readRequired(root, appendixPaths.manuscript),
    readRequired(root, appendixPaths.docs),
  );
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    const result = validateWebSecurityHeaders();
    console.log(
      `OK: deprecated XSS filter headers are absent and CSP procedures are synchronized (${result.synchronizedSectionCount} sections)`,
    );
  } catch (error) {
    console.error(`ERROR: ${error instanceof Error ? error.message : String(error)}`);
    process.exit(1);
  }
}
