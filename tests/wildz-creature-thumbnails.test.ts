import assert from "node:assert/strict";
import { test } from "node:test";
import { renderPortableCreatureThumbnail } from "../src/features/play/WildsCreatureThumbnail.js";
import { deriveBirthGenome } from "../src/features/play/heartbound-genome.js";
import { renderHeartboundSvg } from "../src/features/play/heartbound-renderer.js";
import { sealCollectedCard } from "../src/features/play/portable-card.js";

const pseudoWingCard = sealCollectedCard({
  formId: "titanseal-1",
  ownerReceizId: "thumbnail-owner",
  encounterId: "thumbnail-pseudo-wing",
  capturedAt: "2026-08-21T12:01:00.000Z"
});

const trueWingCard = sealCollectedCard({
  formId: "voltray-1",
  ownerReceizId: "thumbnail-owner",
  encounterId: "thumbnail-functional-wing",
  capturedAt: "2026-08-21T12:02:00.000Z"
});

test("thumbnails replace pseudo-wings with canonical fins or frills", () => {
  const thumbnail = renderPortableCreatureThumbnail(pseudoWingCard);

  assert.doesNotMatch(thumbnail, /data-anatomy="functional-wing"/);
  assert.match(thumbnail, /data-anatomy="(?:fin|frill)"/);
});

test("thumbnails retain functional wings carried by the sealed genome", () => {
  const thumbnail = renderPortableCreatureThumbnail(trueWingCard);

  assert.match(thumbnail, /data-anatomy="functional-wing"/);
});

test("thumbnail art retains a canonical glide membrane distinctly from powered lift", () => {
  const genome = deriveBirthGenome({
    formId: trueWingCard.manifest.formId,
    proofDigest: trueWingCard.proof.digest,
    variant: trueWingCard.manifest.variant.traits
  });
  const glideGenome = {
    ...genome,
    skeleton: { ...genome.skeleton, locomotion: "quadruped" as const }
  };

  const thumbnail = renderHeartboundSvg(glideGenome, "idle", { width: 180, height: 180, title: "glide thumbnail", fit: "full-body" });

  assert.match(thumbnail, /data-anatomy="glide-membrane"/);
  assert.doesNotMatch(thumbnail, /data-anatomy="functional-wing"/);
});
