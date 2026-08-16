/* global console, process */

import { readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { isDeepStrictEqual } from 'node:util';

const root = process.cwd();
const metadataPath = path.join(root, 'dist/index.fict.meta.json');
const contractPath = path.join(root, 'contracts/fict-metadata.json');

function fail(message) {
  throw new Error(`metadata finalization failed: ${message}`);
}

function readJson(filename) {
  return JSON.parse(readFileSync(filename, 'utf8'));
}

function isRecord(value) {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function assertGeneratedHookMatchesContract(name, generated, expected) {
  if (!isRecord(generated) || !isRecord(expected)) {
    fail(`invalid metadata entry for ${name}`);
  }

  if ('directAccessor' in generated) {
    if (generated.directAccessor !== expected.directAccessor || 'objectProps' in generated) {
      fail(`generated direct accessor metadata conflicts with the contract for ${name}`);
    }
    return;
  }

  if (!isRecord(generated.objectProps) || !isRecord(expected.objectProps)) {
    fail(`generated object metadata conflicts with the contract for ${name}`);
  }

  for (const [property, kind] of Object.entries(generated.objectProps)) {
    if (expected.objectProps[property] !== kind) {
      fail(`generated metadata conflicts with the contract for ${name}.${property}`);
    }
  }
}

const generated = readJson(metadataPath);
const contract = readJson(contractPath);

if (generated.version !== contract.version) {
  fail(
    `generated version ${generated.version} does not match contract version ${contract.version}`
  );
}
if (!isDeepStrictEqual(generated.exports ?? {}, contract.exports ?? {})) {
  fail('generated exports conflict with the metadata contract');
}

for (const [name, hookMetadata] of Object.entries(generated.hooks ?? {})) {
  const expected = contract.hooks?.[name];
  if (expected === undefined) {
    fail(`generated metadata contains unexpected hook ${name}`);
  }
  assertGeneratedHookMatchesContract(name, hookMetadata, expected);
}

writeFileSync(metadataPath, `${JSON.stringify(contract)}\n`);
console.log(
  `finalized Fict metadata for ${Object.keys(contract.hooks ?? {}).length} audited hooks`
);
