import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { deriveKaiKlokMoment } from "../src/features/play/kai-klok-moment.js";
import { rootWildsInputInKai } from "../src/features/play/wilds-input-temporal-root.js";

describe("local gameplay input Kai roots", () => {
  const moment = deriveKaiKlokMoment({ occurredAt: "2026-08-13T12:00:00.000Z", authority: "local" });

  it("replaces conflicting training ISO metadata with the exact uPulse projection", () => {
    const early = rootWildsInputInKai({ type: "train", at: "2020-01-01T00:00:00.000Z" }, moment.uPulse);
    const late = rootWildsInputInKai({ type: "train", at: "2030-01-01T00:00:00.000Z" }, moment.uPulse);
    assert.deepEqual(early, late);
    assert.equal(early.kaiUPulse, moment.uPulse);
  });

  it("roots every durable local timestamp shape without changing its action", () => {
    const inputs = [
      { type: "search-point" as const, x: 1, z: 2, searchedAt: "2020-01-01T00:00:00.000Z", ownerReceizId: "player:ari" },
      { type: "capture" as const, encounterId: "encounter:1", capturedAt: "2020-01-01T00:00:00.000Z", ownerReceizId: "player:ari" },
      { type: "fuse-cards" as const, parentAId: "a", parentBId: "b", inheritance: "balanced" as const, fusedAt: "2020-01-01T00:00:00.000Z" },
      { type: "evolve" as const, assetId: "a", evolvedAt: "2020-01-01T00:00:00.000Z" },
      { type: "ascend-card" as const, assetId: "a", at: "2020-01-01T00:00:00.000Z" }
    ];
    for (const input of inputs) {
      const rooted = rootWildsInputInKai(input, moment.uPulse);
      assert.equal(rooted.type, input.type);
      assert.equal(rooted.kaiUPulse, moment.uPulse);
      assert.equal(JSON.stringify(rooted).includes("2020-01-01"), false);
    }
  });
});
