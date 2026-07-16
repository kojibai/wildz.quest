import assert from "node:assert/strict";
import { afterEach, test } from "node:test";
import { NextRequest } from "next/server";
import { WildsWorldService } from "../src/features/play/wilds-world-service.js";
import { hydrateWildsWorldFromReceiz } from "../src/lib/receiz/wilds-world-server.js";

const serviceKey = Symbol.for("receiz.wilds.world.service.v3");
const practiceKey = Symbol.for("receiz.wilds.world.practice.v3");
const hydrationKey = Symbol.for("receiz.wilds.world.hydrated.v3");
const repositoryKey = Symbol.for("receiz.wilds.world.repository.v3");
const mutationQueueKey = Symbol.for("receiz.wilds.world.mutation_queue.v3");

function clearWorldGlobals() {
  const root = globalThis as Record<symbol, unknown>;
  for (const key of [serviceKey, practiceKey, hydrationKey, repositoryKey, mutationQueueKey]) delete root[key];
}

afterEach(clearWorldGlobals);

test("a null Receiz recovery is retried instead of being cached forever", async () => {
  clearWorldGlobals();
  const canonical = new WildsWorldService();
  canonical.tick({
    pulse: "2026-07-15T12:00:00.000Z",
    occurredAt: "2026-07-15T12:00:00.000Z",
    systemActorId: "receiz:pulse"
  });
  const recovered = { checkpoint: canonical.checkpoint(), eventTail: canonical.events() };
  let recoveries = 0;
  (globalThis as Record<symbol, unknown>)[repositoryKey] = {
    recover: async () => ++recoveries === 1 ? null : recovered,
    publish: async () => { throw new Error("unexpected_publish"); },
    audit: async () => { throw new Error("unexpected_audit"); }
  };
  const request = new NextRequest("https://wildz.quest/api/wilds/world/snapshot");

  await hydrateWildsWorldFromReceiz(request);
  await hydrateWildsWorldFromReceiz(request);

  assert.equal(recoveries, 2);
});
