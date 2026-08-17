import assert from "node:assert/strict";
import { test } from "node:test";
import * as THREE from "three";
import { creatureForm } from "../src/features/play/creature-catalog.js";
import { projectCardKaiAppearance, threeCreatureColor } from "../src/features/play/card-kai-appearance.js";
import { deriveKaiKlokMoment } from "../src/features/play/kai-klok-moment.js";
import { discoverLivingCreature } from "../src/features/play/living-taxonomy.js";
import { sealDiscoveredCard } from "../src/features/play/portable-card.js";

test("v3 cards project their exact discovery colors, anatomy, and motion", () => {
  const discoveredAt = "2026-07-17T14:00:00.000Z";
  const form = creatureForm("voltray-1")!;
  const identity = discoverLivingCreature({
    encounterId: "encounter:appearance",
    form,
    discoveredAt,
    location: { x: 8, z: -13 },
    ownerScope: "appearance_owner",
    moment: deriveKaiKlokMoment({ occurredAt: discoveredAt, authority: "world" })
  });
  const card = sealDiscoveredCard({
    identity,
    formId: form.id,
    ownerReceizId: "appearance_owner",
    capturedAt: "2026-07-17T14:01:00.000Z"
  });

  const appearance = projectCardKaiAppearance(card);
  assert.equal(appearance.palette.primary, identity.palette.primary.css);
  assert.equal(appearance.palette.secondary, identity.palette.secondary.css);
  assert.equal(appearance.palette.accent, identity.palette.accent.css);
  assert.equal(appearance.palette.glow, identity.palette.glow.css);
  assert.equal(threeCreatureColor(appearance.palette.primary), `hsl(${identity.palette.primary.hue}, ${identity.palette.primary.chroma}%, ${identity.palette.primary.lightness}%)`);
  assert.notEqual(new THREE.Color(threeCreatureColor(appearance.palette.primary)).getHexString(), "ffffff");
  assert.notEqual(new THREE.Color(threeCreatureColor(appearance.palette.accent)).getHexString(), "ffffff");
  assert.deepEqual(appearance.morphology, {
    head: identity.anatomy.head,
    torso: identity.anatomy.torso,
    limb: identity.anatomy.limb,
    symmetry: identity.anatomy.asymmetry
  });
  assert.equal(appearance.cadenceMs, identity.motion.cadenceMs);
  assert.equal(appearance.fingerprint, identity.visualFingerprint);
  assert.equal(appearance.discoveryIdentity?.identityDigest, identity.identityDigest);
  assert.doesNotMatch(appearance.palette.primary, /100%\)$/);
});
