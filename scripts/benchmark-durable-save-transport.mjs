/** Run after the test build. Real MessageChannel cloning; synthetic frame evidence. */
import { performance } from 'node:perf_hooks';
import { MessageChannel } from 'node:worker_threads';
import { initialPlayState, normalizeWildsRuntimePlayState } from '../.test-build/src/features/play/game-state.js';
import { sealCollectedCard } from '../.test-build/src/features/play/portable-card.js';
import { admitLocallySealedWildsInventory } from '../.test-build/src/features/play/admitted-inventory.js';
import { createWildzDurablePlayStateSaver } from '../.test-build/src/lib/performance/wildz-durable-save.js';
const count = Number(process.argv[2] ?? 1000);
if (!Number.isSafeInteger(count) || count < 1 || count > 10000) throw Error('card_count_invalid');
const owner = 'durable_transport_benchmark';
const session = { schema: 'receiz.wildz.identity_session.v1', keyId: 'transport-benchmark-key', actorId: owner, username: owner, displayName: 'Explorer', portableStateStatus: 'verified', localAuthority: 'verified', remoteStatus: 'offline' };
const inventory = admitLocallySealedWildsInventory(Array.from({ length: count }, (_, i) => sealCollectedCard({ formId: 'mintcub-1', ownerReceizId: owner, encounterId: `save-transport:${i}`, capturedAt: '2026-10-07T00:00:00.000Z' })));
// Include the real per-card runtime projections; construct them outside timing.
const state = normalizeWildsRuntimePlayState({ ...initialPlayState, inventory, selectedAssetId: inventory[0].id }, owner), pins = inventory.map(card => ({ id: card.id, digest: card.proof.digest }));
const channel = new MessageChannel(), messages = [];
const worker = { onmessage: null, onerror: null, postMessage(message) { channel.port1.postMessage(message); }, terminate() { channel.port1.close(); channel.port2.close(); } };
channel.port2.on('message', message => {
  messages.push(message);
  // This measures transport only. The worker processor's actual save/verification
  // is covered separately; acknowledge after the real channel delivery.
  worker.onmessage?.({ data: { id: message.id, ok: true, playState: { ...message.input.playState, inventory: [] }, inventoryPins: pins, inventoryVersion: message.inventoryVersion, includesInventory: false } });
});
let sequence = 0;
const saver = createWildzDurablePlayStateSaver({ createWorker: () => worker, createId: () => `transport:${++sequence}` });
const fallback = async () => { throw Error('unexpected_main_save_fallback'); };
const samples = [];
for (let i = 0; i < 21; i++) {
  const start = performance.now();
  const saving = saver.save({ session, playState: { ...state, worldMastery: i } }, fallback);
  const mainPreparationMs = performance.now() - start;
  await saving;
  // JSON bytes are measured outside the timed preparation/dispatch section.
  samples.push({ mainPreparationMs, messageBytes: Buffer.byteLength(JSON.stringify(messages[i])), cardsInMessage: messages[i].input.playState.inventory.length });
}
const repeated = samples.slice(1), times = repeated.map(item => item.mainPreparationMs).sort((a, b) => a - b);
console.log(JSON.stringify({ scenario: 'Action-save transport with real per-card runtime projections and MessageChannel structured cloning; synthetic CPU evidence, not browser frame timing.', cards: count, first: samples[0], repeated: { messages: repeated.length, messageBytes: repeated[0].messageBytes, cardsInMessage: repeated[0].cardsInMessage, medianMainPreparationMs: times[Math.floor(times.length / 2)], maxMainPreparationMs: times.at(-1) } }, null, 2));
saver.close();
