import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { sealCollectedCard } from "../src/features/play/portable-card";
import { advanceCardMastery, deriveLoadoutSynergy, normalizeCompetitiveLoadout, projectWildsCardMastery, regionalCardUtility } from "../src/features/play/wilds-card-mastery";

const makeCard = (formId: string, encounterId: string) => sealCollectedCard({ formId, ownerReceizId: "player:one", encounterId, capturedAt: "2026-07-15T00:00:00.000Z", kaiPulse: "pulse:1" });

describe("Slice 6 mastery taxonomy", () => {
  it("maps a sealed card to stable deeper roles", () => {
    const card = makeCard("mintcub-1", "capture:one"); const first = projectWildsCardMastery(card); const second = projectWildsCardMastery(card);
    assert.deepEqual(first, second); assert.notEqual(first.primary, first.secondary); assert.equal(Object.keys(first.scores).length, 8);
  });
  it("derives order-independent synergy and bounded regional utility", () => {
    const cards = [makeCard("mintcub-1", "capture:a"), makeCard("voltray-1", "capture:b")]; const synergy = deriveLoadoutSynergy(cards, "wayfinder-hollow");
    assert.deepEqual(synergy, deriveLoadoutSynergy([...cards].reverse(), "wayfinder-hollow")); assert.equal(synergy.score <= 100, true);
    assert.equal(regionalCardUtility(cards[0]!, "wayfinder-hollow").bonus <= 20, true);
  });
  it("deduplicates mastery events and caps competitive power", () => {
    const card = makeCard("mintcub-1", "capture:m"); const state = advanceCardMastery({ card, state: { xp: 0, level: 1, eventIds: [] }, event: { id: "event:1", kind: "battle_win", amount: 40 } });
    assert.deepEqual(advanceCardMastery({ card, state, event: { id: "event:1", kind: "battle_win", amount: 40 } }), state);
    const normalized = normalizeCompetitiveLoadout([card], { regionId: "wayfinder-hollow", maxPower: 100 }); assert.equal(normalized.totalPower <= 100, true);
  });
});
