import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

// Version/identity guard only. npm ci + audit verify the installed dependency
// graph; this does not claim that package.json proves source-byte integrity.
export function validateVendoredLock(lock, readManifest, packagePaths) {
  const errors = [];
  if (lock?.lockfileVersion !== 3 || !lock.packages ||
      typeof lock.packages !== 'object' || Array.isArray(lock.packages)) {
    return ['Expected consumer lockfileVersion 3 with a packages object'];
  }
  const entries = Object.entries(lock.packages).filter(([key]) => key !== '');
  if (entries.length === 0) errors.push('Consumer dependency graph must not be empty');
  if (!Array.isArray(packagePaths) || new Set(packagePaths).size !== packagePaths.length) {
    return ['Expected a unique inventory of vendored package roots'];
  }
  const discovered = new Set(packagePaths);
  const locked = new Set(entries.map(([key]) => key));
  for (const key of discovered) {
    if (!locked.has(key)) errors.push(`Vendored package absent from lock: ${key}`);
  }
  for (const key of locked) {
    if (!discovered.has(key)) errors.push(`Locked package absent from vendor: ${key}`);
  }
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

// Walk only npm package roots, including scoped and nested packages, not arbitrary
// dependency source directories. Refuse links so inventory cannot escape or loop.
export function listVendoredPackages(baseDirectory = process.cwd()) {
  const packages = [];
  const directory = value => {
    const stat = fs.lstatSync(value);
    if (!stat.isDirectory() || stat.isSymbolicLink()) {
      throw new Error(`Expected a vendored directory, not a link/file: ${value}`);
    }
  };
  const visitPackage = value => {
    directory(value);
    packages.push(path.relative(baseDirectory, value).split(path.sep).join('/'));
    const nested = path.join(value, 'node_modules');
    try { fs.lstatSync(nested); } catch (error) {
      if (error.code === 'ENOENT') return;
      throw error;
    }
    visitModules(nested);
  };
  const visitModules = value => {
    directory(value);
    for (const name of fs.readdirSync(value).sort()) {
      if (name === '.bin' || name === '.package-lock.json') continue;
      const target = path.join(value, name);
      if (name.startsWith('@')) {
        directory(target);
        for (const child of fs.readdirSync(target).sort()) visitPackage(path.join(target, child));
      } else visitPackage(target);
    }
  };
  visitModules(path.join(baseDirectory, 'node_modules'));
  return packages.sort();
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  try {
    const lock = JSON.parse(fs.readFileSync('package-lock.json', 'utf8'));
    const errors = validateVendoredLock(lock, key => JSON.parse(
      fs.readFileSync(path.join(key, 'package.json'), 'utf8')), listVendoredPackages());
    if (errors.length) throw new Error(errors.join('\n'));
    console.log('Consumer vendored package identities/versions match root lock');
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
}
