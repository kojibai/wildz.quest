import assert from "node:assert/strict";
import { test } from "node:test";
import { createWildsWorldSourceResolver, prepareWildsWorldOutboxEntry, type WildsWorldOutboxEntry } from "../src/features/play/wilds-world-outbox";
import { initialWildsWorldProjection } from "../src/features/play/wilds-world-state";

function chain() {
  let projection = initialWildsWorldProjection();
  return Array.from({ length: 3 }, (_, i) => {
    const entry: WildsWorldOutboxEntry = { schema: "receiz.wilds_world_outbox_entry.v1", actorId: "builder", guestId: "guest-builder",
      command: { type: "construction.project.create", name: `Home ${i}`, region: { x: i, z: 0 }, commandId: `command:cache:${i}` }, queuedAt: "2026-09-12T00:00:00.000Z" };
    const prepared = prepareWildsWorldOutboxEntry(projection, entry);
    projection = prepared.projection;
    return i === 0 ? prepared.entry : { ...prepared.entry, admittedSource: { anchorId: "command:cache:0", events: prepared.events } };
  });
}

test("source recovery verifies only an appended suffix while rereading exact durable entries", () => {
  const entries = chain(), cache = createWildsWorldSourceResolver();
  cache.resolve("builder", entries.slice(0, 2), new Set());
  assert.equal(cache.stats().verifications, 2);
  cache.resolve("builder", structuredClone(entries.slice(0, 2)), new Set());
  assert.equal(cache.stats().verifications, 2);
  const resolved = cache.resolve("builder", entries, new Set());
  assert.equal(cache.stats().verifications, 3);
  assert.ok(resolved.get(entries[2]!.command.commandId)?.admittedSource?.checkpoint);
  // A caller cannot mutate retained cache authority through a resolved return value.
  Object.assign(resolved.get(entries[1]!.command.commandId)!.admittedSource!.events[0]!, { actorId: "intruder" });
  assert.equal(cache.resolve("builder", entries, new Set()).get(entries[1]!.command.commandId)!.admittedSource!.events[0]!.actorId, "builder");
});

test("changed prefixes, actor switches and bounded eviction force source verification", () => {
  const entries = chain(), cache = createWildsWorldSourceResolver({ maxBytes: 1 });
  cache.resolve("builder", entries, new Set());
  cache.resolve("builder", entries, new Set());
  assert.equal(cache.stats().verifications, 6);
  const normal = createWildsWorldSourceResolver();
  normal.resolve("builder", entries, new Set());
  const altered = structuredClone(entries);
  Object.assign(altered[0]!.admittedSource!.events[0]!, { actorId: "intruder" });
  const result = normal.resolve("builder", altered, new Set());
  assert.equal(result.get(entries[1]!.command.commandId)?.admittedSource?.checkpoint, undefined, "descendants cannot reuse an invalidated anchor");
  normal.resolve("other", [], new Set());
  normal.resolve("builder", entries, new Set());
  assert.ok(normal.stats().verifications >= 7);
});
