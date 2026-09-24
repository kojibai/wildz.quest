import assert from 'node:assert/strict';
import { mkdtemp, writeFile, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { handleReceizMcpMessage, parseReceizMcpToolResult } from '@receiz/mcp-server';
import { verifyReceizOfflineSealedFile } from '@receiz/sdk/offline';

if (!process.env.WILDZ_TEST_SEAL_DIRECTORY) throw new Error('Provide an already-enrolled disposable WILDZ_TEST_SEAL_DIRECTORY; this script never enrolls.');
const workspace = await mkdtemp(join(tmpdir(), 'wildz-v127-offline-mcp-'));
process.env.RECEIZ_OFFLINE_SEAL_DIRECTORY = process.env.WILDZ_TEST_SEAL_DIRECTORY;
process.env.RECEIZ_OFFLINE_WORKSPACE = workspace;
let calls = 0;
const originalFetch = globalThis.fetch;
globalThis.fetch = async () => { calls++; throw new Error('qualification_network_forbidden'); };
let id = 0;
async function call(name, args = {}) {
  const response = await handleReceizMcpMessage({ jsonrpc: '2.0', id: ++id, method: 'tools/call', params: { name, arguments: args } });
  assert.ok(response?.result && !response.result.isError, `MCP ${name} failed`);
  return parseReceizMcpToolResult(response.result);
}
try {
  const initialization = await handleReceizMcpMessage({ jsonrpc: '2.0', id: ++id, method: 'initialize', params: {} });
  assert.equal(initialization.result.serverInfo.version, '127.0.0');
  await writeFile(join(workspace, 'input.json'), JSON.stringify({ game: 'wildz', qualification: 'v127', unknownNamespace: { retained: true } }));
  const status = await call('receiz_offline_seal_status');
  assert.equal(status.ready, true);
  await call('receiz_offline_seal_file', { inputPath: 'input.json', outputPath: 'sealed.receizbundle', mimeType: 'application/json' });
  const verified = await call('receiz_offline_verify_file', { inputPath: 'sealed.receizbundle' });
  assert.equal(verified.verification.ok, true);
  const bytes = new Uint8Array(await readFile(join(workspace, 'sealed.receizbundle')));
  const independent = await verifyReceizOfflineSealedFile({ bytes, filename: 'sealed.receizbundle' });
  assert.equal(independent.ok, true);
  const tampered = bytes.slice(); tampered[Math.floor(tampered.length / 2)] ^= 1;
  assert.equal((await verifyReceizOfflineSealedFile({ bytes: tampered, filename: 'sealed.receizbundle' })).ok, false);
  assert.equal(calls, 0);
  console.log(JSON.stringify({ sdk: '127.0.0', mcp: '127.0.0', ready: true, canonicalVerification: true, tamperRejected: true, networkCalls: calls }));
} finally {
  globalThis.fetch = originalFetch;
  await rm(workspace, { recursive: true, force: true });
}
