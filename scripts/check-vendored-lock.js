import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

// Version/identity guard only. npm ci + audit verify the installed dependency
// graph; this does not claim that package.json proves source-byte integrity.
export function validateVendoredLock(lock, readManifest) {
  const errors = [];
  if (lock?.lockfileVersion !== 3 || !lock.packages ||
      typeof lock.packages !== 'object' || Array.isArray(lock.packages)) {
    return ['Expected consumer lockfileVersion 3 with a packages object'];
  }
  const entries = Object.entries(lock.packages).filter(([key]) => key !== '');
  if (entries.length === 0) errors.push('Consumer dependency graph must not be empty');
  for (const [key, metadata] of entries) {
    if (!/^node_modules\/(?:@[^/]+\/)?[^/]+(?:\/node_modules\/(?:@[^/]+\/)?[^/]+)*$/.test(key) ||
        key.split('/').some(part => part === '.' || part === '..') || key.includes('\\')) {
      errors.push(`Invalid dependency path: ${key}`);
      continue;
    }
    const name = metadata?.name || key.split('node_modules/').at(-1);
    if (typeof metadata?.version !== 'string' || !metadata.version) {
      errors.push(`Missing locked version: ${key}`);
      continue;
    }
    try {
      const actual = readManifest(key);
      if (actual?.name !== name || actual?.version !== metadata.version) {
        errors.push(`Vendored identity/version differs from lock: ${key}`);
      }
    } catch {
      errors.push(`Missing or invalid vendored manifest: ${key}`);
    }
  }
  return errors;
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  try {
    const lock = JSON.parse(fs.readFileSync('package-lock.json', 'utf8'));
    const errors = validateVendoredLock(lock, key => JSON.parse(
      fs.readFileSync(path.join(key, 'package.json'), 'utf8')));
    if (errors.length) throw new Error(errors.join('\n'));
    console.log('Consumer vendored package identities/versions match root lock');
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
}
