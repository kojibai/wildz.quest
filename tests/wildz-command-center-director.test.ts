import test from "node:test";
import assert from "node:assert/strict";
import { deriveKaiKlokMoment } from "../src/features/play/kai-klok-moment";
import { projectWildsCommandCenter, type WildsCommandCenterInput } from "../src/features/play/command-center/director";

const moment = deriveKaiKlokMoment({ occurredAt: "2026-07-16T22:00:00.000Z", authority: "admitted" });
const base: WildsCommandCenterInput = {
  moment,
  connected: true,
  worldRevision: 18,
  energy: 80,
  creature: { assetId: "wilds:one", name: "Onyxcoil", life: "alive", health: 90, maxHealth: 100, fatigue: 10 },
  battle: null,
  mission: { title: "Find the signal", progress: 40, reward: "Bond memory" },
  nearby: { landmark: null, ecology: null, boss: null, livePlayer: null },
  pendingReward: false,
  pendingOperation: null,
  acknowledgedCausalIds: []
};

test("critical creature consequence outranks every opportunity", () => {
  const model = projectWildsCommandCenter({
    ...base,
    creature: { ...base.creature!, health: 4, fatigue: 96 },
    nearby: { ...base.nearby, boss: { id: "boss:one", name: "Glass Titan" } }
  });
  assert.equal(model.now.urgency, "critical");
  assert.equal(model.now.category, "squad");
  assert.equal(model.now.action?.type, "open-trail-pack");
  assert.equal(model.palette.primary, moment.accent);
  assert.equal(model.palette.sides, moment.sides);
});

test("identical snapshots reproduce the exact command model", () => {
  assert.deepEqual(projectWildsCommandCenter(base), projectWildsCommandCenter(base));
});

test("offline state disables only network actions", () => {
  const model = projectWildsCommandCenter({
    ...base,
    connected: false,
    nearby: { ...base.nearby, livePlayer: { id: "p2", name: "@ally" } }
  });
  assert.equal(model.connection, "offline");
  assert.equal(model.priorities.find((item) => item.category === "multiplayer")?.action, null);
  assert.ok(model.priorities.some((item) => item.action?.type === "open-mission"));
});

test("Kai Klok remains the only cadence and geometry authority", () => {
  const model = projectWildsCommandCenter({
    ...base,
    creature: { ...base.creature!, health: 1, fatigue: 100 }
  });
  assert.equal(model.moment, moment);
  assert.deepEqual(model.palette, {
    primary: moment.accent,
    hue: moment.hue,
    sides: moment.sides,
    gate: moment.gate
  });
  assert.equal("phase" in model, false);
});

test("acknowledgement changes emphasis without changing causal truth", () => {
  const first = projectWildsCommandCenter(base);
  const acknowledged = projectWildsCommandCenter({ ...base, acknowledgedCausalIds: [first.causalId] });
  assert.equal(first.isNew, true);
  assert.equal(acknowledged.isNew, false);
  assert.equal(acknowledged.causalId, first.causalId);
  assert.deepEqual(acknowledged.priorities, first.priorities);
});
