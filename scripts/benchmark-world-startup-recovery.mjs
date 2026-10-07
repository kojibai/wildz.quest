/** Run after pnpm test. Synthetic settled sources only; no account data or writes. */
import { performance } from "node:perf_hooks";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
const root = resolve(process.argv[2] ?? ".test-build", "src/features/play");
const load = name => import(pathToFileURL(resolve(root, `${name}.js`)).href);
const { initialWildsWorldProjection } = await load("wilds-world-state");
const { prepareWildsWorldOutboxEntry, restoreWildsWorldEdgeSource } = await load("wilds-world-outbox");
const actorId = "synthetic-startup-account", at = "2026-10-07T12:00:00.000Z";
let projection = initialWildsWorldProjection();
const settled = [];
for (let i = 0; i < 180; i++) {
  const prepared = prepareWildsWorldOutboxEntry(projection, {
    schema: "receiz.wilds_world_outbox_entry.v1", actorId, guestId: "guest-synthetic",
    command: { type: "construction.project.create", commandId: `startup:${i}`, name: `Build ${i}`, region: { x: i, z: 0 } }, queuedAt: at
  }, i ? "startup:0" : null);
  projection = prepared.projection;
  settled.push({ id: prepared.entry.command.commandId, kind: "wilds.world.command", payload: { entry: prepared.entry },
    idempotencyKey: prepared.entry.command.commandId, createdAt: at, attempts: 1, lastError: null });
}
const snapshot = { schema: "receiz.sdk.offline_proof_queue.v1", ownerId: actorId, createdAt: at, updatedAt: at, pending: [], settled, failed: [] };
const storage = { async read() { return structuredClone(snapshot); }, async write() { throw Error("read-only fixture"); } };
let ticks = 0, largestGap = 0, previous = performance.now();
const heartbeat = setInterval(() => { const now = performance.now(); largestGap = Math.max(largestGap, now - previous); previous = now; ticks++; }, 5);
try {
  const start = performance.now();
  const restored = await restoreWildsWorldEdgeSource(initialWildsWorldProjection(), actorId, storage);
  const elapsedMs = performance.now() - start;
  largestGap = Math.max(largestGap, performance.now() - previous);
  if (Object.keys(restored.constructionProjects).length !== 180) throw Error("history was lost");
  console.log(JSON.stringify({ entries: settled.length, projects: 180, elapsedMs, heartbeatTicks: ticks, largestHeartbeatGapMs: largestGap }, null, 2));
} finally { clearInterval(heartbeat); }
