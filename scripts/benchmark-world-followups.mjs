/** Run after pnpm test. Uses only synthetic in-memory construction and material data. */
import { performance } from "node:perf_hooks";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { createReceizInMemoryOfflineProofQueueStorage } from "@receiz/sdk";
const root = resolve(process.argv[2] ?? ".test-build", "src/features/play");
const load = name => import(pathToFileURL(resolve(root, `${name}.js`)).href);
const outbox = await load("wilds-world-outbox");
const { initialWildsWorldProjection } = await load("wilds-world-state");
const additions = await load("wilds-player-world-additions");
const { canonicalPortableCardJson } = await load("portable-card");
const storage = createReceizInMemoryOfflineProofQueueStorage();
const queue = outbox.createWildsWorldEdgeAdmissionQueue({ initialProjection: initialWildsWorldProjection(), persist: entry => outbox.enqueueWildsWorldCommand(entry, storage) });
for (let i = 0; i < 16; i++) await queue.admit({ schema: "receiz.wilds_world_outbox_entry.v1", actorId: "benchmark", guestId: "guest-benchmark",
  command: { type: "construction.project.create", name: `Project ${i}`, region: { x: i, z: 0 }, commandId: `command:benchmark:${i}` }, queuedAt: "2026-09-12T00:00:00.000Z" });
const before = additions.projectWildsOwnedWorldAdditions(queue.current(), "benchmark");
const after = structuredClone(before);
after.consumedMaterialLots["synthetic-lot"] = "synthetic-build";
const equal = additions.sameWildsOwnedWorldAdditions ?? ((a, b) => canonicalPortableCardJson(a) === canonicalPortableCardJson(b));
const results = {};
for (const [name, action] of Object.entries({
  recover16Sources: () => outbox.restoreWildsWorldEdgeSource(queue.current(), "benchmark", storage),
  detectMaterialChange: () => { if (equal(before, after)) throw new Error("Change was missed"); },
  detectUnchangedClone: () => { if (!equal(before, structuredClone(before))) throw new Error("Equal data differs"); }
})) {
  await action();
  const times = [];
  for (let i = 0; i < 15; i++) { const started = performance.now(); await action(); times.push(performance.now() - started); }
  times.sort((a,b) => a-b);
  results[name] = { medianMs: times[7], p95Ms: times[14] };
}
console.log(JSON.stringify(results, null, 2));
