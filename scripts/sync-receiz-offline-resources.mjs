import { createRequire } from 'node:module';
import { copyFile, mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname } from 'node:path';
import { createHash } from 'node:crypto';
const require = createRequire(import.meta.url);
const version = JSON.parse(await readFile(require.resolve('@receiz/sdk/package.json'), 'utf8')).version;
const assets = {
  'sigil_proof.wasm': 'public/zk/document_seal_proof_js/sigil_proof.wasm',
  'document_seal_proof_final.zkey': 'public/zk/document_seal_proof_final.zkey'
};
const hashes = {};
for (const [source, target] of Object.entries(assets)) {
  const path = require.resolve(`@receiz/sdk/offline-resources/${source}`);
  await mkdir(dirname(target), { recursive: true });
  await copyFile(path, target);
  hashes[target.replace(/^public/, '')] = createHash('sha256').update(await readFile(path)).digest('hex');
}
await writeFile('public/zk/receiz-offline-resources.json', JSON.stringify({ sdkVersion: version, sha256: hashes }, null, 2)+'\n');
