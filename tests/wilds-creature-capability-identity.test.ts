import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { emptyAdventureCondition } from "../src/features/play/adventure/card-condition";
import { projectCardKaiAppearance } from "../src/features/play/card-kai-appearance";
import { creatureForm } from "../src/features/play/creature-catalog";
import {
  capabilityPotentialForVisualIdentity,
  projectCreatureCapabilityIdentity,
  projectCreatureCapabilityIdentityDiagnostics,
  projectCreatureRuntimeCapabilities
} from "../src/features/play/creature-capability-identity";
import type { CreatureVisualIdentity } from "../src/features/play/creature-visual-identity";
import { projectActorGripRenderPlan, projectActorWingRenderPlan } from "../src/features/play/WildsCreatureActor";
import { deriveKaiKlokMoment } from "../src/features/play/kai-klok-moment";
import { admitLegacyCard } from "../src/features/play/living-card-proof";
import { discoverLivingCreature } from "../src/features/play/living-taxonomy";
import { projectLivingCardDossier } from "../src/features/play/living-card-dossier";
import { canonicalPortableCardJson, sealCollectedCard, sealDiscoveredCard } from "../src/features/play/portable-card";
import { projectWildsTraversalCapabilities } from "../src/features/play/wilds-traversal-capabilities";

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

  it("requires a canonical functional grip for climb and gives the actor the same grip", () => {
    const armored = projectCardKaiAppearance(card("titanseal-1", "capability:no-grip"));
    const gripAnatomy = {
      ...armored.anatomy,
      appendages: {
        ...armored.anatomy.appendages,
        grip: { presence: "functional" as const, kind: "grip" as const, function: "grip" as const, variant: "crag-pads" }
      }
    };
    const gripVisual: CreatureVisualIdentity = {
      ...armored,
      formId: "grip-test-1",
      anatomy: { ...armored.anatomy },
      appendages: gripAnatomy.appendages
    };

    assert.equal(capabilityPotentialForVisualIdentity({ ...gripVisual, appendages: armored.anatomy.appendages }).includes("climb"), false);
    assert.deepEqual(projectActorGripRenderPlan(armored.anatomy), { kind: "none", padCount: 0 });
    assert.equal(capabilityPotentialForVisualIdentity(gripVisual).includes("climb"), true);
    assert.deepEqual(projectActorGripRenderPlan(gripAnatomy), { kind: "functional-grip", padCount: 4 });
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

  it("unlocks structured traversal at levels 2, 3, and 5 while condition can only suppress it", () => {
    const winged = card("voltray-1", "capability:runtime");
    const identity = projectCreatureCapabilityIdentity(winged);
    const base = emptyAdventureCondition(winged.id);
    const levelThree = projectCreatureRuntimeCapabilities(identity, { ...base, xp: { flight: 200 } });
    const levelFive = projectCreatureRuntimeCapabilities(identity, { ...base, xp: { flight: 400 }, mastery: { flight: 80 } });
    const injured = projectCreatureRuntimeCapabilities(identity, {
      ...base,
      injuries: [{ id: "injury:wing", kind: "wing", severity: 2, sourceEventId: "fall:1" }]
    });

    assert.deepEqual(projectCreatureRuntimeCapabilities(identity, base).capabilities, []);
    assert.deepEqual(levelThree.capabilities, ["glide"]);
    assert.deepEqual(levelFive.capabilities, ["glide", "flight"]);
    assert.ok(levelFive.abilities[0]!.currentPower >= projectCreatureRuntimeCapabilities(identity, base).abilities[0]!.currentPower);
    for (const ability of levelFive.abilities) {
      if (ability.descriptor.traversalGrant) assert.equal(ability.available, levelFive.capabilities.includes(ability.descriptor.traversalGrant));
    }
    assert.deepEqual(injured.capabilities, []);
  });

  it("uses an exact structured upgrade registry and keys every output-affecting condition", () => {
    const asset = card("mintcub-1", "capability:structured-upgrade");
    const identity = projectCreatureCapabilityIdentity(asset);
    const base = emptyAdventureCondition(asset.id);
    const levelTwo = { ...base, xp: { exploration: 100 } };
    const upgraded = { ...levelTwo, upgradeIds: ["deep-current-swim"] };
    const before = projectCreatureCapabilityIdentityDiagnostics();
    const ordinary = projectCreatureRuntimeCapabilities(identity, levelTwo);
    const afterOrdinary = projectCreatureCapabilityIdentityDiagnostics();
    const swimming = projectCreatureRuntimeCapabilities(identity, upgraded);
    const afterUpgrade = projectCreatureCapabilityIdentityDiagnostics();

    assert.equal(ordinary.capabilities.includes("swim"), false);
    assert.equal(swimming.capabilities.includes("swim"), true);
    assert.notEqual(swimming, ordinary);
    assert.equal(afterOrdinary.runtimeSlowBuilds, before.runtimeSlowBuilds + 1);
    assert.equal(afterUpgrade.runtimeSlowBuilds, afterOrdinary.runtimeSlowBuilds + 1);
    assert.equal(projectCreatureRuntimeCapabilities(identity, upgraded), swimming);
    assert.deepEqual(projectCreatureCapabilityIdentityDiagnostics(), afterUpgrade);
  });

  it("includes XP, mastery, revision, and upgrades in canonical traversal projections", () => {
    const asset = card("voltray-1", "capability:outer-cache");
    const base = emptyAdventureCondition(asset.id);
    const levelThree = { ...base, xp: { flight: 200 } };
    const levelFive = { ...base, xp: { flight: 400 }, mastery: { flight: 20 } };

    const glide = projectWildsTraversalCapabilities(structuredClone(asset), levelThree);
    const flight = projectWildsTraversalCapabilities(structuredClone(asset), levelFive);
    assert.notEqual(glide, flight);
    assert.deepEqual(glide.capabilities, ["glide"]);
    assert.deepEqual(flight.capabilities, ["glide", "flight"]);
  });

  it("keeps family slot names and actions coherent for Grove, Spark, Stone, and Tide", () => {
    for (const [formId, element] of [["mintcub-1", "Grove"], ["voltray-1", "Spark"], ["titanseal-1", "Stone"], ["ledgerfox-1", "Tide"]] as const) {
      const asset = card(formId, `capability:family:${element}`);
      const ability = projectCreatureCapabilityIdentity(asset).abilities[0]!;
      assert.equal(ability.name, asset.manifest.abilityNames[0]);
      assert.match(ability.action, new RegExp(element, "i"));
      assert.equal(ability.tags.includes(element.toLowerCase()), true);
    }
    assert.equal(projectCreatureCapabilityIdentity(card("ledgerfox-1", "capability:current")).specialties[0]!.family, "current");
  });

  it("preserves representative V1, V2, V3, and living revision proofs byte-for-byte", () => {
    const v1 = card("mintcub-1", "capability:proof:v1");
    const v2 = sealCollectedCard({ formId: "voltray-1", ownerReceizId: "wilds.capability.player", encounterId: "capability:proof:v2", capturedAt: "2026-08-21T12:00:00.000Z", generatorVersion: 2 });
    const form = creatureForm("ledgerfox-1")!;
    const discoveredAt = "2026-08-21T12:00:00.000Z";
    const discovery = discoverLivingCreature({ encounterId: "capability:proof:v3", form, discoveredAt, location: { x: 8, z: 13 }, ownerScope: "wilds.capability.player", moment: deriveKaiKlokMoment({ occurredAt: discoveredAt, authority: "world" }) });
    const v3 = sealDiscoveredCard({ identity: discovery, formId: form.id, ownerReceizId: discovery.discovery.ownerScope, capturedAt: discoveredAt });
    const living = admitLegacyCard(v3, "2026-08-21T12:00:01.000Z");

    for (const asset of [v1, v2, v3, living]) {
      const before = canonicalPortableCardJson(asset);
      const identity = projectCreatureCapabilityIdentity(asset);
      projectCreatureRuntimeCapabilities(identity, emptyAdventureCondition(asset.id));
      assert.equal(canonicalPortableCardJson(asset), before);
    }
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
