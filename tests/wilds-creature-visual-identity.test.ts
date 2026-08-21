import assert from "node:assert/strict";
import { test } from "node:test";
import { projectCardCreatureVisualIdentity } from "../src/features/play/creature-visual-identity.js";
import { sealCollectedCard } from "../src/features/play/portable-card.js";

const pseudoWingCard = sealCollectedCard({
  formId: "titanseal-1",
  ownerReceizId: "visual-identity-owner",
  encounterId: "visual-identity-pseudo-wing",
  capturedAt: "2026-08-21T12:00:00.000Z"
});

test("canonical visual identity makes a dragon-archetype card wingless when its sealed genome has no wings", () => {
  const first = projectCardCreatureVisualIdentity(pseudoWingCard);
  const second = projectCardCreatureVisualIdentity(pseudoWingCard);

  assert.equal(first.appendages.wings.presence, "absent");
  assert.deepEqual(first, second);
});
