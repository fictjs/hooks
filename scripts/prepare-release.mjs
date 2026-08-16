/* global console, process */

import { readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const packagePath = path.join(root, 'package.json');
const readmePath = path.join(root, 'README.md');
const nextVersion = process.argv[2];

if (!nextVersion) {
  throw new Error('usage: pnpm release:prepare <version>');
}
if (!/^\d+\.\d+\.\d+(?:[-+][0-9A-Za-z.-]+)?$/.test(nextVersion)) {
  throw new Error(`invalid package version: ${nextVersion}`);
}

const pkg = JSON.parse(readFileSync(packagePath, 'utf8'));
const readme = readFileSync(readmePath, 'utf8');
const versionedHookDocsPattern =
  /https:\/\/github\.com\/fictjs\/hooks\/(?:blob|tree)\/v[^/\s)]+\/docs\/hooks/g;
const versionedHookDocsLinks = readme.match(versionedHookDocsPattern) ?? [];

if (versionedHookDocsLinks.length === 0) {
  throw new Error('README does not contain versioned hook documentation links');
}

pkg.version = nextVersion;
const updatedReadme = readme.replace(versionedHookDocsPattern, (url) =>
  url.replace(/\/v[^/]+\/docs\/hooks$/, `/v${nextVersion}/docs/hooks`)
);

writeFileSync(packagePath, `${JSON.stringify(pkg, null, 2)}\n`);
writeFileSync(readmePath, updatedReadme);

console.log(
  `prepared @fictjs/hooks@${nextVersion} and synchronized ${versionedHookDocsLinks.length} README documentation links`
);
