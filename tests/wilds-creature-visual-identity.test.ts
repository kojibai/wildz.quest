import assert from "node:assert/strict";
import { test } from "node:test";
import { projectCardCreatureVisualIdentity } from "../src/features/play/creature-visual-identity.js";
import { sealCollectedCard } from "../src/features/play/portable-card.js";
import { projectActorWingRenderPlan } from "../src/features/play/WildsCreatureActor.js";
import { projectCardKaiAppearance } from "../src/features/play/card-kai-appearance.js";
import { deriveBirthGenome } from "../src/features/play/heartbound-genome.js";
import { createWildsCreatureFace } from "../src/features/play/wilds-creature-face.js";

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
  const vestigialWingAnatomy = {
    ...visual.anatomy,
    appendages: {
      ...visual.appendages,
      wings: { presence: "vestigial" as const, kind: "wing" as const, function: "glide" as const, variant: "vestigial-wing-test" }
    }
  };

  assert.deepEqual(projectActorWingRenderPlan({ ...visual.anatomy, appendages: projectCardCreatureVisualIdentity(pseudoWingCard).appendages }), { kind: "none", pairCount: 0 });
  assert.deepEqual(projectActorWingRenderPlan(vestigialWingAnatomy), { kind: "none", pairCount: 0 });
  assert.deepEqual(projectActorWingRenderPlan({ ...visual.anatomy, appendages: visual.appendages }), { kind: "functional-wing", pairCount: 2 });
  assert.deepEqual(projectActorWingRenderPlan(glideAnatomy), { kind: "glide-membrane", pairCount: 2 });
});

const trueWingCard = sealCollectedCard({
  formId: "voltray-1",
  ownerReceizId: "visual-identity-owner",
  encounterId: "visual-identity-functional-wing",
  capturedAt: "2026-08-21T12:03:00.000Z"
});

test("creature face proportions and blink timing reach 3D appearance from the sealed genome", () => {
  const genome = deriveBirthGenome({ formId: trueWingCard.manifest.formId, proofDigest: trueWingCard.proof.digest, variant: trueWingCard.manifest.variant.traits });
  const visual = projectCardCreatureVisualIdentity(trueWingCard);
  const appearance = projectCardKaiAppearance(trueWingCard);
  assert.ok("face" in visual, "3D visual identity must include the genome face");
  assert.ok("face" in appearance, "card appearance must retain face traits");
  const face = visual.face as { geometry: unknown; blinkMs: number };
  assert.deepEqual(face.geometry, genome.identity!.faceGeometry);
  assert.equal(face.blinkMs, genome.identity!.behavior.blinkMs);
  assert.deepEqual(appearance.face, visual.face);
});

test("genome face geometry is batched, can close its eyes, and stays below the previous face budget", () => {
  const visual = projectCardCreatureVisualIdentity(trueWingCard);
  const geometry = createWildsCreatureFace(visual.face, "#66aa77", "#bbdd66", "#338855", visual.fingerprint);
  assert.equal(geometry.groups.length, 0);
  assert.ok(geometry.index!.count / 3 < 1808, "detail must fit the previous eleven-mesh face budget");
  for (const name of ["position", "normal", "color", "faceClosed", "faceClosedNormal", "faceOcular"]) {
    const attribute = geometry.getAttribute(name);
    assert.ok(attribute);
    assert.ok(Array.from(attribute.array).every(Number.isFinite));
  }
  const changed = createWildsCreatureFace({ ...visual.face, geometry: { ...visual.face.geometry, cheek: 1.24, eyeSpacing: 1.16, muzzle: 1.18 } }, "#66aa77", "#bbdd66", "#338855", visual.fingerprint);
  assert.notDeepEqual(geometry.getAttribute("position").array, changed.getAttribute("position").array);
  geometry.dispose(); changed.dispose();
});
