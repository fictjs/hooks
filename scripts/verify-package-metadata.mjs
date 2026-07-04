/* global console, process */

import { spawnSync } from 'node:child_process';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';

const root = process.cwd();

function fail(message) {
  console.error(`metadata verification failed: ${message}`);
  process.exit(1);
}

function readJson(relativePath) {
  return JSON.parse(readFileSync(path.join(root, relativePath), 'utf8'));
}

function walkFiles(directory) {
  const result = [];
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    const absolute = path.join(directory, entry.name);
    if (entry.isDirectory()) {
      result.push(...walkFiles(absolute));
    } else if (entry.isFile()) {
      result.push(absolute);
    }
  }
  return result;
}

function extractReactiveHookNames() {
  const sourceDir = path.join(root, 'src');
  const hooks = new Set();

  for (const file of walkFiles(sourceDir)) {
    if (!file.endsWith('.ts')) continue;
    const source = readFileSync(file, 'utf8');
    const exportMatch = source.match(/export function (use[A-Z][A-Za-z0-9_]*)\b/);
    if (!exportMatch) continue;

    const annotationMatch = source.match(/@fictReturn\s+([^\n*]+)/);
    if (!annotationMatch) continue;

    const annotation = annotationMatch[1]?.trim() ?? '';
    if (
      annotation === '{}' ||
      annotation === '{ }' ||
      !/['"]?(signal|memo|store|effect)['"]?/.test(annotation)
    ) {
      continue;
    }

    hooks.add(exportMatch[1]);
  }

  return hooks;
}

function parseNpmPackJson(stdout) {
  const match = stdout.match(/(\[\s*\{[\s\S]*\}\s*\])\s*$/);
  if (!match) {
    fail('npm pack did not return a JSON array');
  }
  return JSON.parse(match[1]);
}

const requiredDistFiles = [
  'dist/fict.manifest.json',
  'dist/index.cjs',
  'dist/index.d.cts',
  'dist/index.d.ts',
  'dist/index.fict.meta.json',
  'dist/index.js'
];

const pkg = readJson('package.json');
if (pkg.name !== '@fictjs/hooks') {
  fail(`unexpected package name ${pkg.name}`);
}
if (
  typeof pkg.version !== 'string' ||
  !/^\d+\.\d+\.\d+(?:[-+][0-9A-Za-z.-]+)?$/.test(pkg.version)
) {
  fail(`unexpected package version ${pkg.version}`);
}
if (pkg.fict?.metadata !== './dist/index.fict.meta.json') {
  fail('package.json must declare fict.metadata as ./dist/index.fict.meta.json');
}

for (const file of requiredDistFiles) {
  if (!existsSync(path.join(root, file))) {
    fail(`missing build artifact ${file}`);
  }
}

const metadata = readJson('dist/index.fict.meta.json');
if (metadata.version !== 1) {
  fail(`expected metadata version 1, got ${metadata.version}`);
}

const metadataHooks = new Set(Object.keys(metadata.hooks ?? {}));
const expectedHooks = extractReactiveHookNames();
const missingHooks = [...expectedHooks].filter((hook) => !metadataHooks.has(hook));
if (missingHooks.length > 0) {
  fail(`metadata is missing reactive hook entries: ${missingHooks.sort().join(', ')}`);
}

const manifest = readJson('dist/fict.manifest.json');
if (Object.keys(manifest).length === 0) {
  fail('dist/fict.manifest.json must not be empty');
}

const pack = spawnSync('npm', ['pack', '--dry-run', '--json'], {
  cwd: root,
  encoding: 'utf8'
});
if (pack.status !== 0) {
  process.stderr.write(pack.stderr);
  fail(`npm pack --dry-run failed with exit code ${pack.status}`);
}

const [packed] = parseNpmPackJson(pack.stdout);
if (!packed || !Array.isArray(packed.files)) {
  fail('npm pack result did not include a files list');
}
if (packed.name !== pkg.name) {
  fail(`npm pack result used package name ${packed.name}, expected ${pkg.name}`);
}
if (packed.version !== pkg.version) {
  fail(`npm pack result used package version ${packed.version}, expected ${pkg.version}`);
}

const packedFiles = new Set(packed.files.map((file) => file.path));
for (const file of ['package.json', 'README.md', 'LICENSE', ...requiredDistFiles]) {
  if (!packedFiles.has(file)) {
    fail(`npm pack output is missing ${file}`);
  }
}

console.log(
  `metadata verification passed: ${expectedHooks.size} reactive hooks, ${packed.files.length} packed files`
);
