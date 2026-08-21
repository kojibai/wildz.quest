import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { emptyAdventureCondition } from "../src/features/play/adventure/card-condition";
import { projectCardKaiAppearance } from "../src/features/play/card-kai-appearance";
import {
  capabilityPotentialForVisualIdentity,
  projectCreatureCapabilityIdentity,
  projectCreatureCapabilityIdentityDiagnostics,
  projectCreatureRuntimeCapabilities
} from "../src/features/play/creature-capability-identity";
import type { CreatureVisualIdentity } from "../src/features/play/creature-visual-identity";
import { projectActorWingRenderPlan } from "../src/features/play/WildsCreatureActor";
import { projectLivingCardDossier } from "../src/features/play/living-card-dossier";
import { canonicalPortableCardJson, sealCollectedCard } from "../src/features/play/portable-card";

function card(formId: string, encounterId: string) {
  return sealCollectedCard({
    formId,
    ownerReceizId: "wilds.capability.player",
    encounterId,
    capturedAt: "2026-08-21T12:00:00.000Z"
  });
}

describe("proof-derived creature capability identity", () => {
  it("is deterministic, individualized, immutable, and never rewrites the admitted proof", () => {
    const firstCard = card("mintcub-1", "capability:first");
    const secondCard = card("mintcub-1", "capability:second");
    const before = canonicalPortableCardJson(firstCard);

    const first = projectCreatureCapabilityIdentity(firstCard);
    const repeated = projectCreatureCapabilityIdentity(firstCard);
    const second = projectCreatureCapabilityIdentity(secondCard);

    assert.equal(first, repeated);
    assert.equal(Object.isFrozen(first), true);
    assert.equal(Object.isFrozen(first.specialties), true);
    assert.equal(first.digestInput.proofDigest, firstCard.proof.digest);
    assert.notDeepEqual(first.specialties, second.specialties);
    assert.equal(canonicalPortableCardJson(firstCard), before);
  });

  it("derives traversal only from explicit functional anatomy", () => {
    const winged = card("voltray-1", "capability:winged");
    const grounded = card("mintcub-1", "capability:grounded");
    const aquatic = card("amberbeak-1", "capability:aquatic");
    const tide = card("ledgerfox-1", "capability:tide-aquatic");

    assert.deepEqual(projectCreatureCapabilityIdentity(winged).traversalPotential, ["glide", "flight"]);
    assert.equal(projectCreatureCapabilityIdentity(grounded).traversalPotential.includes("flight"), false);
    assert.deepEqual(projectCreatureCapabilityIdentity(aquatic).traversalPotential, ["swim"]);
    assert.equal(projectCardKaiAppearance(tide).anatomy.appendages.fins.presence, "functional");
    assert.equal(projectCreatureCapabilityIdentity(tide).traversalPotential.includes("swim"), true);
  });

  it("never treats absent or vestigial wings as flight anatomy", () => {
    const grounded = projectCardKaiAppearance(card("mintcub-1", "capability:no-wings")).anatomy;
    const vestigial: CreatureVisualIdentity = {
      formId: "test-vestigial-1",
      palette: { primary: "#000", secondary: "#111", accent: "#222", glow: "#333" },
      anatomy: { body: "winged", detail: "wings", locomotion: "biped", surface: "feather" },
      appendages: {
        ...grounded.appendages,
        wings: { presence: "vestigial", kind: "wing", function: "glide", variant: "flightless-fan" }
      },
      morphology: { head: 1, torso: 1, limb: 1, symmetry: 0 },
      cadenceMs: 1200,
      fingerprint: "vestigial-test"
    };

    assert.equal(capabilityPotentialForVisualIdentity({ ...vestigial, appendages: grounded.appendages }).includes("flight"), false);
    assert.equal(capabilityPotentialForVisualIdentity(vestigial).includes("glide"), false);
  });

  it("keeps every flight-capable identity paired with the actor's same functional wing anatomy", () => {
    const appearance = projectCardKaiAppearance(card("voltray-1", "capability:actor-wing"));
    const identity = projectCreatureCapabilityIdentity(card("voltray-1", "capability:actor-wing-copy"));
    const matching = projectCardKaiAppearance(card("voltray-1", "capability:actor-wing-copy"));

    assert.equal(projectActorWingRenderPlan(appearance.anatomy).pairCount, 2);
    assert.equal(identity.traversalPotential.includes("flight"), true);
    assert.deepEqual(projectActorWingRenderPlan(matching.anatomy), { kind: "functional-wing", pairCount: 2 });
  });

  it("lets progression scale existing potential while condition can only suppress it", () => {
    const winged = card("voltray-1", "capability:runtime");
    const identity = projectCreatureCapabilityIdentity(winged);
    const base = emptyAdventureCondition(winged.id);
    const trained = projectCreatureRuntimeCapabilities(identity, {
      ...base,
      xp: { flight: 400 },
      mastery: { flight: 80 },
      upgradeIds: ["deep-current-swim"]
    });
    const injured = projectCreatureRuntimeCapabilities(identity, {
      ...base,
      injuries: [{ id: "injury:wing", kind: "wing", severity: 2, sourceEventId: "fall:1" }]
    });

    assert.equal(trained.capabilities.includes("swim"), false);
    assert.ok(trained.abilities[0]!.currentPower >= projectCreatureRuntimeCapabilities(identity, base).abilities[0]!.currentPower);
    assert.deepEqual(injured.capabilities, []);
  });

  it("performs zero repeated slow work for the same asset, identity, and condition", () => {
    const asset = card("voltray-1", "capability:cache");
    const condition = emptyAdventureCondition(asset.id);
    const identity = projectCreatureCapabilityIdentity(asset);
    projectCreatureRuntimeCapabilities(identity, condition);
    const warm = projectCreatureCapabilityIdentityDiagnostics();

    for (let index = 0; index < 300; index += 1) {
      projectCreatureRuntimeCapabilities(projectCreatureCapabilityIdentity(asset), condition);
    }

    assert.deepEqual(projectCreatureCapabilityIdentityDiagnostics(), warm);
  });

  it("shows the current proof revision's structured ability descriptors in the dossier", () => {
    const asset = card("voltray-1", "capability:dossier");
    const dossier = projectLivingCardDossier(asset, "https://wildz.quest");

    assert.deepEqual(dossier.gameplay.abilities.map((ability) => ability.name), asset.manifest.abilityNames);
    assert.equal(dossier.gameplay.abilities.every((ability) => ability.action.length > 0 && ability.tags.length >= 2), true);
  });
});
