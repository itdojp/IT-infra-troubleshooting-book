#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import util from 'node:util';
import { fileURLToPath } from 'node:url';

const REPO_SLUG = 'IT-infra-troubleshooting-book';
const GITHUB_URL = `https://github.com/itdojp/${REPO_SLUG}`;
const GITHUB_GIT_URL = `${GITHUB_URL}.git`;
const PACKAGE_GIT_URL = `git+${GITHUB_GIT_URL}`;
const PAGES_URL = `https://itdojp.github.io/${REPO_SLUG}/`;
const ISSUES_URL = `${GITHUB_URL}/issues`;
const EXPECTED_PACKAGE_NAME = 'it-infra-troubleshooting-book';
const EXPECTED_DOC_ASSETS = [
  'assets/css/main.css',
  'assets/css/mobile-responsive.css',
  'assets/css/syntax-highlighting.css',
  'assets/js/theme.js',
  'assets/js/search.js',
  'assets/js/code-copy-lightweight.js',
  'assets/images/itdo_logo_48x48_blue.png',
];

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const docsDir = path.join(root, 'docs');
const errors = [];

function repoPath(...parts) {
  return path.join(root, ...parts);
}

function display(file) {
  return path.relative(root, file).replaceAll(path.sep, '/') || '.';
}

function readText(relPath) {
  const file = repoPath(relPath);
  try {
    return fs.readFileSync(file, 'utf8');
  } catch (error) {
    errors.push(`${relPath}: ${error.message}`);
    return '';
  }
}

function readJson(relPath) {
  const file = repoPath(relPath);
  try {
    return JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch (error) {
    errors.push(`${relPath}: invalid JSON: ${error.message}`);
    return {};
  }
}

function stripYamlScalar(raw) {
  if (raw == null) return '';
  let value = String(raw).trim();
  if (!value) return '';
  if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
    value = value.slice(1, -1);
  }
  return value.trim();
}

function parseRootScalars(yamlText) {
  const scalars = {};
  for (const line of yamlText.split(/\r?\n/)) {
    const match = line.match(/^([A-Za-z0-9_]+):\s*(.*?)\s*$/);
    if (!match) continue;
    const [, key, raw] = match;
    if (raw === '') continue;
    scalars[key] = stripYamlScalar(raw);
  }
  return scalars;
}

function parseRepositoryGithub(yamlText) {
  const lines = yamlText.split(/\r?\n/);
  let inRepository = false;
  for (const line of lines) {
    if (/^repository:\s*$/.test(line)) {
      inRepository = true;
      continue;
    }
    if (inRepository && /^\S/.test(line)) {
      inRepository = false;
    }
    if (!inRepository) continue;
    const match = line.match(/^\s+github:\s*(.*?)\s*$/);
    if (match) return stripYamlScalar(match[1]);
  }
  return '';
}

function normalizeRoute(raw, context) {
  if (typeof raw !== 'string') {
    errors.push(`${context}: path must be a string`);
    return null;
  }
  let route = raw.trim();
  if (!route) {
    errors.push(`${context}: path is empty`);
    return null;
  }
  if (/^(https?:|mailto:)/i.test(route)) {
    errors.push(`${context}: external paths are not allowed in book navigation (${route})`);
    return null;
  }
  if (route.includes('..')) {
    errors.push(`${context}: path must not contain '..' (${route})`);
    return null;
  }
  if (!route.startsWith('/')) route = `/${route}`;
  if (route !== '/' && !/[./][A-Za-z0-9]+$/.test(route) && !route.endsWith('/')) route += '/';
  return route;
}

function parseNavigation(yamlText) {
  const sections = {};
  let currentKey = null;
  let currentItem = null;

  const flush = () => {
    if (!currentKey || !currentItem) return;
    sections[currentKey] ??= [];
    sections[currentKey].push(currentItem);
    currentItem = null;
  };

  for (const line of yamlText.split(/\r?\n/)) {
    const sectionMatch = line.match(/^([A-Za-z0-9_]+):\s*$/);
    if (sectionMatch) {
      flush();
      currentKey = sectionMatch[1];
      continue;
    }
    if (!currentKey) continue;
    const titleMatch = line.match(/^\s*-\s+title:\s*(.*?)\s*$/);
    if (titleMatch) {
      flush();
      currentItem = { title: stripYamlScalar(titleMatch[1]) };
      continue;
    }
    const directPathMatch = line.match(/^\s*-\s+path:\s*(.*?)\s*$/);
    if (directPathMatch) {
      flush();
      currentItem = { path: stripYamlScalar(directPathMatch[1]) };
      continue;
    }
    const pathMatch = line.match(/^\s+path:\s*(.*?)\s*$/);
    if (pathMatch && currentItem) {
      currentItem.path = stripYamlScalar(pathMatch[1]);
    }
  }
  flush();
  return sections;
}

function parseConfigStructurePaths(yamlText) {
  const paths = [];
  let inStructure = false;
  for (const line of yamlText.split(/\r?\n/)) {
    if (/^structure:\s*$/.test(line)) {
      inStructure = true;
      continue;
    }
    if (inStructure && /^\S/.test(line)) break;
    if (!inStructure) continue;
    const match = line.match(/^\s+path:\s*(.*?)\s*$/);
    if (match) paths.push(stripYamlScalar(match[1]));
  }
  return paths;
}

function parseFrontMatter(relPath) {
  const text = readText(relPath);
  const match = text.match(/^---\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)/);
  if (!match) {
    errors.push(`${relPath}: missing YAML front matter`);
    return {};
  }
  const front = {};
  for (const line of match[1].split(/\r?\n/)) {
    const scalar = line.match(/^([A-Za-z0-9_-]+):\s*(.*?)\s*$/);
    if (!scalar) continue;
    front[scalar[1]] = stripYamlScalar(scalar[2]);
  }
  return front;
}

function routeCandidates(route) {
  if (route === '/') return [path.join(docsDir, 'index.md')];
  const rel = route.replace(/^\//, '');
  const candidates = [];
  if (rel.endsWith('/')) {
    const dirRel = rel.slice(0, -1);
    candidates.push(path.join(docsDir, dirRel, 'index.md'));
    candidates.push(path.join(docsDir, `${dirRel}.md`));
  } else {
    candidates.push(path.join(docsDir, rel));
    candidates.push(path.join(docsDir, `${rel}.md`));
    candidates.push(path.join(docsDir, rel, 'index.md'));
  }
  return candidates;
}

function routeExists(route) {
  return routeCandidates(route).some((candidate) => fs.existsSync(candidate) && fs.statSync(candidate).isFile());
}

function expectEqual(actual, expected, label) {
  if (actual !== expected) {
    errors.push(`${label}: expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`);
  }
}

function expectDeepEqual(actual, expected, label) {
  if (!util.isDeepStrictEqual(actual, expected)) {
    errors.push(`${label}: expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`);
  }
}

function ensureArray(data, label) {
  if (!Array.isArray(data)) {
    errors.push(`${label}: expected an array`);
    return [];
  }
  return data;
}

const bookConfig = readJson('book-config.json');
const publicBookConfig = readJson('docs/book-config.json');
const packageJson = readJson('package.json');
const packageLock = readJson('package-lock.json');
const docsConfigText = readText('docs/_config.yml');
const navigationText = readText('docs/_data/navigation.yml');
const docsIndexFrontMatter = parseFrontMatter('docs/index.md');
const docsConfig = parseRootScalars(docsConfigText);
const navigation = parseNavigation(navigationText);
const navEntries = [
  ...ensureArray(navigation.introduction, 'docs/_data/navigation.yml introduction'),
  ...ensureArray(navigation.chapters, 'docs/_data/navigation.yml chapters'),
  ...ensureArray(navigation.appendices, 'docs/_data/navigation.yml appendices'),
];
const navChapterEntries = ensureArray(navigation.chapters, 'docs/_data/navigation.yml chapters');
const navAppendixEntries = ensureArray(navigation.appendices, 'docs/_data/navigation.yml appendices');
const normalizedNavEntries = navEntries.map((item, index) => ({
  title: item.title,
  path: normalizeRoute(item.path, `docs/_data/navigation.yml entry ${index + 1}`),
}));

const canonical = {
  title: bookConfig.title,
  description: bookConfig.description,
  author: bookConfig.author,
  version: bookConfig.version,
  language: bookConfig.language,
  license: bookConfig.license,
  homepage: PAGES_URL,
  repository: { url: GITHUB_GIT_URL, branch: 'main' },
};

for (const [relPath, config] of [
  ['book-config.json', bookConfig],
  ['docs/book-config.json', publicBookConfig],
]) {
  expectEqual(config.title, canonical.title, `${relPath} title`);
  expectEqual(config.description, canonical.description, `${relPath} description`);
  expectEqual(config.author, canonical.author, `${relPath} author`);
  expectEqual(config.version, canonical.version, `${relPath} version`);
  expectEqual(config.language, canonical.language, `${relPath} language`);
  expectEqual(config.license, canonical.license, `${relPath} license`);
  expectEqual(config.homepage, PAGES_URL, `${relPath} homepage`);
  expectDeepEqual(config.repository, canonical.repository, `${relPath} repository`);
}

expectEqual(packageJson.name, EXPECTED_PACKAGE_NAME, 'package.json name');
expectEqual(packageJson.version, canonical.version, 'package.json version');
expectEqual(packageJson.description, canonical.description, 'package.json description');
expectEqual(packageJson.author, canonical.author, 'package.json author');
expectEqual(packageJson.license, canonical.license, 'package.json license');
expectDeepEqual(packageJson.repository, { type: 'git', url: PACKAGE_GIT_URL }, 'package.json repository');
expectEqual(packageJson.homepage, PAGES_URL, 'package.json homepage');
expectDeepEqual(packageJson.bugs, { url: ISSUES_URL }, 'package.json bugs');
expectEqual(packageJson.scripts?.['check:metadata'], 'node scripts/check-metadata-consistency.js', 'package.json scripts.check:metadata');
if (!String(packageJson.scripts?.test || '').includes('npm run check:metadata')) {
  errors.push('package.json scripts.test: expected to run npm run check:metadata');
}

expectEqual(packageLock.name, EXPECTED_PACKAGE_NAME, 'package-lock.json name');
expectEqual(packageLock.version, canonical.version, 'package-lock.json version');
expectEqual(packageLock.packages?.['']?.name, EXPECTED_PACKAGE_NAME, 'package-lock.json packages[""].name');
expectEqual(packageLock.packages?.['']?.version, canonical.version, 'package-lock.json packages[""].version');

for (const [key, expected] of [
  ['title', canonical.title],
  ['description', canonical.description],
  ['author', canonical.author],
  ['version', canonical.version],
  ['lang', 'ja'],
  ['url', 'https://itdojp.github.io'],
  ['baseurl', `/${REPO_SLUG}`],
  ['license', canonical.license],
  ['homepage', PAGES_URL],
  ['repository_url', GITHUB_URL],
]) {
  expectEqual(docsConfig[key], expected, `docs/_config.yml ${key}`);
}
expectEqual(parseRepositoryGithub(docsConfigText), GITHUB_URL, 'docs/_config.yml repository.github');

for (const [key, expected] of [
  ['title', canonical.title],
  ['description', canonical.description],
  ['author', canonical.author],
  ['version', canonical.version],
]) {
  expectEqual(docsIndexFrontMatter[key], expected, `docs/index.md front matter ${key}`);
}

function structureEntries(config, section, label) {
  return ensureArray(config.structure?.[section], `${label} structure.${section}`).map((item, index) => {
    const route = normalizeRoute(item.path, `${label} structure.${section}[${index}].path`);
    return {
      id: item.id,
      title: item.title,
      description: item.description,
      path: route,
    };
  });
}

const expectedChapters = navChapterEntries.map((item, index) => ({
  id: `chapter${String(index + 1).padStart(2, '0')}`,
  title: item.title,
  description: bookConfig.structure.chapters?.[index]?.description,
  path: normalizeRoute(item.path, `expected chapter ${index + 1}`),
}));
const appendixIds = ['appendix-a', 'appendix-b', 'appendix-c', 'appendix-d', 'appendix-e', 'appendix-f'];
const expectedAppendices = navAppendixEntries.map((item, index) => ({
  id: appendixIds[index],
  title: item.title,
  description: bookConfig.structure.appendices?.[index]?.description,
  path: normalizeRoute(item.path, `expected appendix ${index + 1}`),
}));

for (const [label, config] of [
  ['book-config.json', bookConfig],
  ['docs/book-config.json', publicBookConfig],
]) {
  expectDeepEqual(structureEntries(config, 'chapters', label), expectedChapters, `${label} structure.chapters`);
  expectDeepEqual(structureEntries(config, 'appendices', label), expectedAppendices, `${label} structure.appendices`);
}

const structureConfigPaths = parseConfigStructurePaths(docsConfigText).map((p, index) => normalizeRoute(p, `docs/_config.yml structure path ${index + 1}`));
const expectedStructureRoutes = [...expectedChapters, ...expectedAppendices].map((entry) => entry.path);
expectDeepEqual(structureConfigPaths, expectedStructureRoutes, 'docs/_config.yml structure paths');

const seen = new Map();
for (const [index, entry] of normalizedNavEntries.entries()) {
  if (!entry.path) continue;
  if (seen.has(entry.path)) {
    errors.push(`docs/_data/navigation.yml: duplicate path ${entry.path} at entries ${seen.get(entry.path)} and ${index + 1}`);
  } else {
    seen.set(entry.path, index + 1);
  }
  if (!routeExists(entry.path)) {
    const candidates = routeCandidates(entry.path).map(display).join(', ');
    errors.push(`docs/_data/navigation.yml: path ${entry.path} has no matching Markdown source (${candidates})`);
  }
}

for (const route of expectedStructureRoutes) {
  if (!seen.has(route)) {
    errors.push(`book structure route ${route} is missing from docs/_data/navigation.yml`);
  }
}

for (const asset of EXPECTED_DOC_ASSETS) {
  const assetPath = path.join(docsDir, asset);
  if (!fs.existsSync(assetPath) || !fs.statSync(assetPath).isFile() || fs.statSync(assetPath).size === 0) {
    errors.push(`docs/${asset}: required public asset is missing or empty`);
  }
}

if (errors.length > 0) {
  console.error(`Metadata consistency check failed with ${errors.length} issue(s):`);
  for (const error of errors) console.error(`- ${error}`);
  process.exit(1);
}

console.log(`OK: metadata, navigation, structure, and required assets are consistent (${normalizedNavEntries.length} navigation entries)`);
