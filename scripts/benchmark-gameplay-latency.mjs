/** Run after pnpm test. Synthetic CPU/transport evidence, not browser FPS. */
import assert from 'node:assert/strict';
import { performance } from 'node:perf_hooks';
import { playableInventory, isPlayableAsset } from '../.test-build/src/features/play/game-state.js';
import { sealCollectedCard } from '../.test-build/src/features/play/portable-card.js';
import { admitLocallySealedWildsInventory } from '../.test-build/src/features/play/admitted-inventory.js';
import { initialWildsWorldProjection } from '../.test-build/src/features/play/wilds-world-state.js';
import { creationWorldSourceHead } from '../.test-build/src/features/play/creation/world-source.js';
import { projectActiveCreationContext } from '../.test-build/src/features/play/creation/live-context.js';
import { creationContextFixture } from '../.test-build/tests/support/creation-fixtures.js';
import { projectWildzPlayerStateResponse } from '../.test-build/src/lib/performance/wildz-player-state-transport.js';

const count = Number(process.argv[2] ?? 10000);
assert.ok(Number.isInteger(count) && count > 0 && count <= 10000);
const inventory = admitLocallySealedWildsInventory(Array.from({ length: count }, (_, i) => sealCollectedCard({
  formId: 'mintcub-1', ownerReceizId: 'latency-benchmark', encounterId: `latency:${i}`, capturedAt: '2026-10-06T00:00:00.000Z'
})));
const state = { inventory, adventureConditions: {} };
const exhaustive = () => inventory.filter(card => isPlayableAsset(state, card.id));
assert.deepEqual(playableInventory(state), exhaustive());
const world = initialWildsWorldProjection();
world.constructionCommandReceipts = Object.fromEntries(Array.from({ length: count }, (_, i) => [
  `command:${i}`, { commandDigest: `sha256:${'a'.repeat(64)}`, eventId: `event:${i}` }
]));
const context = creationContextFixture();
function median(run) {
  run();
  const samples = Array.from({ length: 5 }, () => { const start = performance.now(); run(); return performance.now() - start; });
  return samples.sort((a, b) => a - b)[2];
}
// Only transport size is measured here; admission remains the server's job.
const record = { playerId: 'latency-benchmark', sourceDigest: `sha256:${'a'.repeat(64)}`, revision: 1, player: { playState: state } };
const receipt = projectWildzPlayerStateResponse(record, { compact: true, incomingDigest: record.sourceDigest });
console.log(JSON.stringify({
  scenario: 'Exact locally sealed cards; five warmed CPU samples. World receipts are synthetic.',
  cards: count,
  roster: { exhaustiveMs: median(exhaustive), singlePassMs: median(() => playableInventory(state)) },
  closedBuilder: { eagerCheckpointMs: median(() => creationWorldSourceHead(world)), inactiveContextMs: median(() => projectActiveCreationContext({ active: false, context, world: () => world, physical: { projections: [], obstacles: [] } })) },
  syncResponse: { fullBytes: Buffer.byteLength(JSON.stringify({ ok: true, record })), receiptBytes: Buffer.byteLength(JSON.stringify(receipt.body)), unchangedPollBytes: 0 }
}, null, 2));
