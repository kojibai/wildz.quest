/** Synthetic owner state only. Run after pnpm test; never reads a user's Seal. */
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { performance } from 'node:perf_hooks';
import { createMemoryWildzContinuityDatabase } from '../.test-build/tests/support/memory-wildz-continuity-database.js';
import { loadWildzRestoredOwnerState } from '../.test-build/src/features/identity/wildz-restore.js';
import { wildzOwnerScope } from '../.test-build/src/lib/receiz/wildz-identity-repository.js';
import { admittedInventoryDiagnostics } from '../.test-build/src/features/play/admitted-inventory.js';

const filename = process.argv[2] ?? 'output/performance/wallet-history-fixture.json';
const { record, session } = JSON.parse(await readFile(filename, 'utf8'));
const database = createMemoryWildzContinuityDatabase();
await database.transaction(['ownerStates'], 'readwrite', tx =>
  tx.put('ownerStates', record, wildzOwnerScope(session.keyId, session.actorId)));
const samples = [];
for (let run = 0; run < 6; run++) {
  const admissionsBefore = admittedInventoryDiagnostics().verifierCalls;
  let last = performance.now(), maxGap = 0, ticks = 0;
  const heartbeat = setInterval(() => {
    const now = performance.now(); maxGap = Math.max(maxGap, now - last); last = now; ticks++;
  }, 0);
  const start = performance.now();
  const restored = await loadWildzRestoredOwnerState({ database, session });
  const elapsedMs = performance.now() - start;
  await new Promise(resolve => setTimeout(resolve, 0));
  clearInterval(heartbeat);
  assert.ok(restored);
  assert.equal(restored.playState.inventory[0].proof.digest, record.playState.inventory[0].proof.digest);
  assert.deepEqual(restored.playState.player, record.playState.player);
  const proofAdmissions = admittedInventoryDiagnostics().verifierCalls - admissionsBefore;
  if (run > 0) assert.equal(proofAdmissions, 0, 'fresh storage objects reuse the authenticated head');
  samples.push({ run, path: run ? 'retained-head' : 'first-admission', elapsedMs, proofAdmissions, ticks, maxHeartbeatGapMs: maxGap });
}
const median = values => [...values].sort((a, b) => a - b)[Math.floor(values.length / 2)];
console.log(JSON.stringify({
  scope: 'Node synthetic local owner restoration; not browser, network, or physical iPhone timing',
  cards: record.playState.inventory.length,
  historyEvents: record.playState.inventory[0].manifest.history.events.length,
  medianRetainedMs: median(samples.slice(1).map(s => s.elapsedMs)), samples
}, null, 2));
