import assert from "node:assert/strict";
import { it } from "node:test";
import { createWildsCrewCausalEvent as create, verifyWildsCrewCausalEvent as verify } from "../src/features/play/wilds-crew-causality";
const base = { workerId: "gatherer", jobId: "gather", commandDigest: "command", observedKaiUPulse: 100, previous: null, dependencies: [], phase: "proposed" as const };

it("orders gathering before dependent hauling despite tied or regressed local clocks", async () => {
  const proposed = await create(base);
  const pending = await create({ ...base, previous: proposed, phase: "pending", observedKaiUPulse: 99 });
  const admitted = await create({ ...base, previous: pending, phase: "admitted", admittedWorldEventIds: ["world:harvest"], observedKaiUPulse: 98 });
  const haul = await create({ ...base, workerId: "hauler", jobId: "haul", dependencies: [admitted], observedKaiUPulse: 90 });
  assert.equal(haul.observedKaiUPulse, 90);
  assert.equal(haul.causalKaiUPulse, 100);
  assert.equal(haul.sequence, 4);
  assert.deepEqual(haul.parents, [admitted.eventId]);
  assert.equal(await verify(haul), true);
  assert.equal(await verify({ ...haul, observedKaiUPulse: 91 }), false);
});

it("blocks speculative effects, pending dependencies and overlapping worker actions", async () => {
  const proposed = await create(base);
  await assert.rejects(create({ ...base, dependencies: [proposed] }), /dependency_unadmitted/);
  await assert.rejects(create({ ...base, previous: proposed, jobId: "other" }), /worker_busy/);
  await assert.rejects(create({ ...base, phase: "admitted", admittedWorldEventIds: ["invented"] }), /transition_invalid/);
  await assert.rejects(create({ ...base, previous: proposed, phase: "pending", admittedWorldEventIds: ["invented"] }), /effects_invalid/);
  const completed = await create({ ...base, previous: proposed, phase: "admitted", admittedWorldEventIds: ["real"] });
  await assert.rejects(create({ ...base, previous: completed, phase: "admitted", admittedWorldEventIds: ["real"] }), /transition_invalid/);
});

it("replays deterministically without inventing dependencies between independent workers", async () => {
  const a = await create(base);
  assert.deepEqual(await create(base), a);
  const b = await create({ ...base, workerId: "other" });
  assert.equal(a.sequence, b.sequence);
  assert.deepEqual(b.parents, []);
  assert.notEqual(a.eventId, b.eventId);
});

it("verifies the previous event even when a dependency shares its event ID", async () => {
  const proposed = await create(base);
  const admitted = await create({...base,previous:proposed,phase:"admitted",admittedWorldEventIds:["world:actual"]});
  await assert.rejects(create({...base,previous:{...admitted,phase:"pending"},dependencies:[admitted],phase:"admitted",admittedWorldEventIds:["world:duplicate"]}), /parent_invalid/);
  await assert.rejects(create({...base,previous:proposed,phase:"bogus" as never}), /input_invalid/);
});
