/* global console, process */

import { spawnSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const root = process.cwd();
const require = createRequire(import.meta.url);

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

const reactiveKinds = new Set(['signal', 'memo', 'store', 'effect']);

function assertHookMetadataMatches(hookName, expected, actual) {
  if (expected.directAccessor) {
    if (actual?.directAccessor !== expected.directAccessor) {
      fail(
        `metadata mismatch for ${hookName}.directAccessor: expected ${expected.directAccessor}, got ${actual?.directAccessor}`
      );
    }
    if (actual.objectProps) {
      fail(`metadata mismatch for ${hookName}: expected direct accessor, got object props`);
    }
    return;
  }

  const expectedProps = expected.objectProps ?? {};
  const actualProps = actual?.objectProps ?? {};
  const expectedNames = Object.keys(expectedProps);
  const actualNames = Object.keys(actualProps);
  const missing = expectedNames.filter((name) => !(name in actualProps)).sort();
  const unexpected = actualNames.filter((name) => !(name in expectedProps)).sort();
  if (missing.length > 0 || unexpected.length > 0) {
    fail(
      `metadata props mismatch for ${hookName}` +
        (missing.length > 0 ? `; missing: ${missing.join(', ')}` : '') +
        (unexpected.length > 0 ? `; unexpected: ${unexpected.join(', ')}` : '')
    );
  }

  for (const [propName, expectedKind] of Object.entries(expectedProps)) {
    if (!reactiveKinds.has(expectedKind)) {
      fail(`unsupported expected reactive kind for ${hookName}.${propName}: ${expectedKind}`);
    }
    if (actualProps[propName] !== expectedKind) {
      fail(
        `metadata kind mismatch for ${hookName}.${propName}: expected ${expectedKind}, got ${actualProps[propName]}`
      );
    }
  }
}

function smokeDistEntry(entry, label) {
  if (typeof entry.useDebounceFn !== 'function') {
    fail(`${label} dist entry does not export useDebounceFn`);
  }

  const calls = [];
  const controls = entry.useDebounceFn(
    (value) => {
      calls.push(value);
    },
    10,
    {
      leading: true,
      trailing: false
    }
  );

  controls.run(label);
  controls.cancel();

  if (calls.length !== 1 || calls[0] !== label) {
    fail(`${label} dist entry failed useDebounceFn smoke test`);
  }
}

function parseNpmPackJson(stdout) {
  const match = stdout.match(/(\[\s*\{[\s\S]*\}\s*\])\s*$/);
  if (!match) {
    fail('npm pack did not return a JSON array');
  }
  return JSON.parse(match[1]);
}

function assertSameSet(label, actual, expected) {
  const actualSet = new Set(actual);
  const expectedSet = new Set(expected);
  const missing = [...expectedSet].filter((entry) => !actualSet.has(entry)).sort();
  const unexpected = [...actualSet].filter((entry) => !expectedSet.has(entry)).sort();

  if (missing.length > 0 || unexpected.length > 0) {
    fail(
      `${label} mismatch` +
        (missing.length > 0 ? `; missing: ${missing.join(', ')}` : '') +
        (unexpected.length > 0 ? `; unexpected: ${unexpected.join(', ')}` : '')
    );
  }
}

function toRootRelative(absolutePath) {
  return path.relative(root, absolutePath).replace(/\\/g, '/');
}

const requiredDistFiles = [
  'dist/index.cjs',
  'dist/index.d.cts',
  'dist/index.d.ts',
  'dist/index.fict.meta.json',
  'dist/index.js'
];
const requiredHookDocs = [
  'docs/hooks/useAsyncState.md',
  'docs/hooks/useClickOutside.md',
  'docs/hooks/useClipboard.md',
  'docs/hooks/useCounter.md',
  'docs/hooks/useDebounceFn.md',
  'docs/hooks/useDocumentVisibility.md',
  'docs/hooks/useEventListener.md',
  'docs/hooks/useFetch.md',
  'docs/hooks/useFocusWithin.md',
  'docs/hooks/useFullscreen.md',
  'docs/hooks/useGeolocation.md',
  'docs/hooks/useHover.md',
  'docs/hooks/useIdle.md',
  'docs/hooks/useIntersectionObserver.md',
  'docs/hooks/useIntervalFn.md',
  'docs/hooks/useKeyPress.md',
  'docs/hooks/useLocalStorage.md',
  'docs/hooks/useMediaQuery.md',
  'docs/hooks/useMount.md',
  'docs/hooks/useMutationObserver.md',
  'docs/hooks/useNetwork.md',
  'docs/hooks/usePermission.md',
  'docs/hooks/usePrevious.md',
  'docs/hooks/useRafFn.md',
  'docs/hooks/useRequest.md',
  'docs/hooks/useResizeObserver.md',
  'docs/hooks/useScroll.md',
  'docs/hooks/useSessionStorage.md',
  'docs/hooks/useSize.md',
  'docs/hooks/useStorage.md',
  'docs/hooks/useThrottleFn.md',
  'docs/hooks/useTimeoutFn.md',
  'docs/hooks/useTitle.md',
  'docs/hooks/useToggle.md',
  'docs/hooks/useUnmount.md',
  'docs/hooks/useVirtualList.md',
  'docs/hooks/useWebSocket.md',
  'docs/hooks/useWindowScroll.md',
  'docs/hooks/useWindowSize.md'
];
const requiredPackageFiles = [
  'LICENSE',
  'README.md',
  'package.json',
  ...requiredDistFiles,
  ...requiredHookDocs
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
assertSameSet('package.json files allowlist', pkg.files ?? [], ['dist', 'docs']);

const hookDocFiles = walkFiles(path.join(root, 'docs/hooks')).map(toRootRelative);
assertSameSet('hook documentation files', hookDocFiles, requiredHookDocs);

const readme = readFileSync(path.join(root, 'README.md'), 'utf8');
const versionedDocsRoot = `https://github.com/fictjs/hooks/tree/v${pkg.version}/docs/hooks`;
const versionedDocsFileRoot = `https://github.com/fictjs/hooks/blob/v${pkg.version}/`;
const expectedReadmeHookDocLinks = [
  versionedDocsRoot,
  ...requiredHookDocs.map((doc) => `${versionedDocsFileRoot}${doc}`)
];
const readmeHookDocLinks = [...readme.matchAll(/\]\(([^)\s]*docs\/hooks[^)\s]*)\)/g)].map(
  (match) => match[1]
);
assertSameSet(
  'versioned README hook documentation links',
  readmeHookDocLinks,
  expectedReadmeHookDocLinks
);

const packageEntryPaths = [
  ['main', pkg.main],
  ['module', pkg.module],
  ['types', pkg.types],
  ['exports["."].import', pkg.exports?.['.']?.import],
  ['exports["."].require', pkg.exports?.['.']?.require]
];

function assertPackageEntryPath(field, value) {
  if (typeof value !== 'string') {
    fail(`package.json ${field} must be a string path`);
  }

  const normalized = value.replace(/^\.\//, '');
  if (!requiredDistFiles.includes(normalized)) {
    fail(`package.json ${field} points at ${value}, which is not a required dist artifact`);
  }
}

for (const [field, value] of packageEntryPaths) {
  assertPackageEntryPath(field, value);
}

const exportTypes = pkg.exports?.['.']?.types;
if (!exportTypes || typeof exportTypes !== 'object' || Array.isArray(exportTypes)) {
  fail('package.json exports["."].types must be an object with import and require paths');
}
if (exportTypes.import !== './dist/index.d.ts') {
  fail('package.json exports["."].types.import must point at ./dist/index.d.ts');
}
if (exportTypes.require !== './dist/index.d.cts') {
  fail('package.json exports["."].types.require must point at ./dist/index.d.cts');
}
assertPackageEntryPath('exports["."].types.import', exportTypes.import);
assertPackageEntryPath('exports["."].types.require', exportTypes.require);

const distDir = path.join(root, 'dist');
if (!existsSync(distDir)) {
  fail('missing build artifact directory dist');
}
const distFiles = walkFiles(distDir).map(toRootRelative);
assertSameSet('dist artifacts', distFiles, requiredDistFiles);

const esmEntry = await import(pathToFileURL(path.join(root, 'dist/index.js')).href);
smokeDistEntry(esmEntry, 'esm');
const cjsEntry = require(path.join(root, 'dist/index.cjs'));
smokeDistEntry(cjsEntry, 'cjs');

const metadata = readJson('dist/index.fict.meta.json');
const metadataContract = readJson('contracts/fict-metadata.json');
const expectedRuntimeExports = new Set([
  'clearRequestCache',
  'useMount',
  'useUnmount',
  ...Object.keys(metadataContract.hooks ?? {})
]);
assertSameSet('ESM runtime exports', Object.keys(esmEntry), expectedRuntimeExports);
assertSameSet('CommonJS runtime exports', Object.keys(cjsEntry), expectedRuntimeExports);
if (metadata.version !== metadataContract.version) {
  fail(`expected metadata version ${metadataContract.version}, got ${metadata.version}`);
}
if (JSON.stringify(metadata.exports ?? {}) !== JSON.stringify(metadataContract.exports ?? {})) {
  fail('metadata exports do not match contracts/fict-metadata.json');
}

const metadataHooks = new Set(Object.keys(metadata.hooks ?? {}));
const expectedHookMetadata = new Map(Object.entries(metadataContract.hooks ?? {}));
const expectedHooks = new Set(expectedHookMetadata.keys());
const missingHooks = [...expectedHooks].filter((hook) => !metadataHooks.has(hook));
if (missingHooks.length > 0) {
  fail(`metadata is missing reactive hook entries: ${missingHooks.sort().join(', ')}`);
}
const unexpectedHooks = [...metadataHooks].filter((hook) => !expectedHooks.has(hook));
if (unexpectedHooks.length > 0) {
  fail(`metadata includes unexpected hook entries: ${unexpectedHooks.sort().join(', ')}`);
}
for (const [hookName, expected] of expectedHookMetadata) {
  assertHookMetadataMatches(hookName, expected, metadata.hooks?.[hookName]);
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
assertSameSet('npm pack output files', packedFiles, requiredPackageFiles);

console.log(
  `metadata verification passed: ${expectedRuntimeExports.size} runtime exports, ` +
    `${expectedHooks.size} reactive hooks, ${packed.files.length} packed files`
);
