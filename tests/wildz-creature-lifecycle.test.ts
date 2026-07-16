import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { initialPlayState } from "../src/features/play/game-state";
import { isLivingCardAsset } from "../src/features/play/living-card-types";
import { admitLegacyCard } from "../src/features/play/living-card-proof";
import type { LegacyPortableCardAsset } from "../src/features/play/portable-card";
import { applyCreatureLifeEvent, createCreatureLife } from "../src/features/games/lifecycle/creature-life-event";
import { projectCreatureAppearanceHistory } from "../src/features/games/lifecycle/creature-appearance";
import { assertCreaturePlayable, mergeCreatureBranches, sealRetirement } from "../src/features/games/lifecycle/creature-retirement";
import { projectCreatureMemorial } from "../src/features/games/lifecycle/creature-memorial";

describe("Wildz living creature lifecycle", () => {
  const livingCard = () => {
    const card = initialPlayState.inventory[0];
    return isLivingCardAsset(card) ? card : admitLegacyCard(card as LegacyPortableCardAsset, "2026-07-16T12:30:00.000Z");
  };
  it("recovery restores function while preserving repaired visible history", () => {
    const base = createCreatureLife("creature:a", 1000);
    const injured = applyCreatureLifeEvent(base, { eventId: "injury:1", creatureId: "creature:a", sourceGameId: "mortal-arena", sourceReceiptDigest: `sha256:${"1".repeat(64)}`, sequence: 1, occurredAt: "2026-07-16T12:00:00.000Z", kind: "injury", payload: { amount: 700, mark: "fractured-horn" } });
    const recovered = applyCreatureLifeEvent(injured, { eventId: "recovery:2", creatureId: "creature:a", sourceGameId: "hearttree", sourceReceiptDigest: `sha256:${"2".repeat(64)}`, sequence: 2, occurredAt: "2026-07-17T12:00:00.000Z", kind: "recovery", payload: { amount: 400, resource: "heartroot" } });
    assert.equal(injured.vitality, 300);
    assert.equal(recovered.vitality, 700);
    assert.ok(projectCreatureAppearanceHistory(recovered).marks.some((mark) => mark.kind === "repaired-scar" && mark.id === "fractured-horn"));
  });

  it("seals retirement into the living card and makes it permanently unplayable", () => {
    const card = livingCard();
    const retired = sealRetirement(card, {
      creatureId: card.id,
      previousRevisionDigest: card.manifest.revisions.at(-1)!.digest,
      matchReceiptDigest: `sha256:${"a".repeat(64)}`,
      finalVitality: 0,
      teamOutcome: "victory",
      retiredAt: "2026-07-16T13:00:00.000Z"
    }, { verified: true, mortalOptIn: true });
    assert.throws(() => assertCreaturePlayable(retired.card), /canonically retired/i);
    assert.equal(mergeCreatureBranches(retired.card, card).status, "retired");
    assert.equal(projectCreatureMemorial(retired.card).honor, "victorious-sacrifice");
  });

  it("refuses surprise or nonzero retirement", () => {
    const card = livingCard();
    const proposal = { creatureId: card.id, previousRevisionDigest: card.manifest.revisions.at(-1)!.digest, matchReceiptDigest: `sha256:${"b".repeat(64)}`, finalVitality: 1, teamOutcome: "defeat" as const, retiredAt: "2026-07-16T13:00:00.000Z" };
    assert.throws(() => sealRetirement(card, proposal, { verified: true, mortalOptIn: true }), /zero Vitality/i);
    assert.throws(() => sealRetirement(card, { ...proposal, finalVitality: 0 }, { verified: true, mortalOptIn: false }), /opt-in/i);
  });
});
