import assert from "node:assert/strict";
import { test } from "node:test";
import { projectCardCreatureVisualIdentity } from "../src/features/play/creature-visual-identity.js";
import { sealCollectedCard } from "../src/features/play/portable-card.js";
import { projectActorWingRenderPlan } from "../src/features/play/WildsCreatureActor.js";

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

test("3D actors render only canonical powered-lift or glide wing pairs", () => {
  const visual = projectCardCreatureVisualIdentity(trueWingCard);
  const glideAnatomy = {
    ...visual.anatomy,
    appendages: {
      ...visual.appendages,
      wings: { ...visual.appendages.wings, presence: "functional" as const, function: "glide" as const, variant: "glide-membrane-test" }
    }
  };

  assert.deepEqual(projectActorWingRenderPlan({ ...visual.anatomy, appendages: projectCardCreatureVisualIdentity(pseudoWingCard).appendages }), { kind: "none", pairCount: 0 });
  assert.deepEqual(projectActorWingRenderPlan({ ...visual.anatomy, appendages: visual.appendages }), { kind: "functional-wing", pairCount: 2 });
  assert.deepEqual(projectActorWingRenderPlan(glideAnatomy), { kind: "glide-membrane", pairCount: 2 });
});

const trueWingCard = sealCollectedCard({
  formId: "voltray-1",
  ownerReceizId: "visual-identity-owner",
  encounterId: "visual-identity-functional-wing",
  capturedAt: "2026-08-21T12:03:00.000Z"
});
