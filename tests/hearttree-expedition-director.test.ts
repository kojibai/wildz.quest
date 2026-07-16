import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  generateHearttreeExpedition,
  validateHearttreeSolvability,
  type HearttreeExpeditionDefinition
} from "../src/features/play/hearttree/expedition-director";
import { emptyHearttreeCondition, projectHearttreeCard, type HearttreeCardCapability } from "../src/features/play/hearttree/card-capability";
import { sealCollectedCard } from "../src/features/play/portable-card";

function capability(formId: string, encounterId = formId): HearttreeCardCapability {
  const source = sealCollectedCard({
    formId,
    ownerReceizId: "hearttree.player",
    encounterId: `director:${encounterId}`,
    capturedAt: "2026-07-16T14:00:00.000Z"
  });
  return projectHearttreeCard(source, emptyHearttreeCondition(source.id));
}

describe("Hearttree squad-dependent expedition director", () => {
  it("reproduces the exact expedition for the same seed and proof-pinned squad", () => {
    const grove = capability("mintcub-1", "deterministic");
    const input = { seed: "hearttree:daily:1", squad: [grove], history: [], mortal: false } as const;
    const first = generateHearttreeExpedition(input);
    const replay = generateHearttreeExpedition(input);

    assert.deepEqual(first, replay);
    assert.equal(first.schema, "receiz.wilds.hearttree_expedition.v1");
    assert.deepEqual(first.squadPins, [{ assetId: grove.assetId, proofDigest: grove.proofDigest }]);
    assert.deepEqual(first.chambers.map((chamber) => chamber.kind), ["rootway", "memory", "master", "choice"]);
  });

  it("changes topology, hazards, counters, and music for materially different cards", () => {
    const flying = capability("voltray-1", "flying");
    const stone = capability("titanseal-1", "stone");
    const aerial = generateHearttreeExpedition({ seed: "hearttree:dynamic", squad: [flying], history: [], mortal: false });
    const bastion = generateHearttreeExpedition({ seed: "hearttree:dynamic", squad: [stone], history: [], mortal: false });

    assert.notEqual(aerial.chambers[0]?.topology, bastion.chambers[0]?.topology);
    assert.notDeepEqual(aerial.chambers.flatMap((chamber) => chamber.hazards), bastion.chambers.flatMap((chamber) => chamber.hazards));
    assert.notDeepEqual(aerial.boss.counters, bastion.boss.counters);
    assert.notDeepEqual(aerial.audioProfile.cardMotifs, bastion.audioProfile.cardMotifs);
  });

  it("builds solvable normal runs for representative one, two, and three-card squads", () => {
    const grove = capability("mintcub-1", "one");
    const spark = capability("voltray-1", "two");
    const stone = capability("titanseal-1", "three");

    for (const squad of [[grove], [grove, spark], [grove, spark, stone]]) {
      const definition = generateHearttreeExpedition({ seed: `hearttree:${squad.length}`, squad, history: [], mortal: false });
      const validation = validateHearttreeSolvability(definition, squad);
      assert.equal(validation.ok, true);
      assert.ok(validation.solutionBands >= 1);
      assert.deepEqual(validation.missing, []);
    }
  });

  it("adapts to injuries instead of generating a route that needs a lost capability", () => {
    const source = sealCollectedCard({
      formId: "voltray-1",
      ownerReceizId: "hearttree.player",
      encounterId: "director:injured",
      capturedAt: "2026-07-16T14:00:00.000Z"
    });
    const injured = projectHearttreeCard(source, {
      ...emptyHearttreeCondition(source.id),
      injuries: [{ id: "injury:wing", kind: "wing", severity: 2, sourceEventId: "event:fall" }]
    });
    const definition = generateHearttreeExpedition({ seed: "hearttree:injured", squad: [injured], history: [], mortal: false });

    assert.equal(injured.traversal.has("flight"), false);
    assert.equal(definition.chambers.some((chamber) => chamber.routes.every((route) => route.requires.includes("traversal:flight"))), false);
    assert.equal(validateHearttreeSolvability(definition, [injured]).ok, true);
  });

  it("discloses exact irreversible risk only on an explicitly Mortal run", () => {
    const grove = capability("mintcub-1", "mortal");
    const normal = generateHearttreeExpedition({ seed: "hearttree:risk", squad: [grove], history: [], mortal: false });
    const mortal = generateHearttreeExpedition({ seed: "hearttree:risk", squad: [grove], history: [], mortal: true });

    assert.equal(normal.mortalDisclosure, null);
    assert.deepEqual(mortal.mortalDisclosure, {
      consequence: "permanent-death",
      assetIdsAtRisk: [grove.assetId],
      reversible: false
    });
    assert.equal(mortal.chambers.at(-1)?.risk, "mortal");
  });

  it("diminishes already-mastered opportunities without erasing history", () => {
    const grove = capability("mintcub-1", "history");
    const first = generateHearttreeExpedition({ seed: "hearttree:history", squad: [grove], history: [], mortal: false });
    const masteredIds = first.masteryOpportunities.map((opportunity) => opportunity.id);
    const repeated = generateHearttreeExpedition({
      seed: "hearttree:history",
      squad: [grove],
      history: [{ id: "receipt:1", expeditionId: first.id, masteryOpportunityIds: masteredIds }],
      mortal: false
    });

    assert.deepEqual(repeated.masteryOpportunities.map((opportunity) => opportunity.id), masteredIds);
    assert.equal(repeated.masteryOpportunities.every((opportunity) => opportunity.xpMultiplier === 0.25), true);
  });

  it("rejects dead cards, duplicate proof pins, invalid squad sizes, and tampered definitions", () => {
    const grove = capability("mintcub-1", "invalid");
    const dead = { ...grove, playable: false, condition: { ...grove.condition, life: "dead" as const } };
    assert.throws(() => generateHearttreeExpedition({ seed: "hearttree:dead", squad: [dead], history: [], mortal: false }), /hearttree_card_dead/);
    assert.throws(() => generateHearttreeExpedition({ seed: "hearttree:duplicate", squad: [grove, grove], history: [], mortal: false }), /hearttree_squad_duplicate/);
    assert.throws(() => generateHearttreeExpedition({ seed: "hearttree:empty", squad: [], history: [], mortal: false }), /hearttree_squad_size_invalid/);
    assert.throws(() => generateHearttreeExpedition({ seed: "hearttree:large", squad: [grove, capability("voltray-1", "a"), capability("titanseal-1", "b"), capability("ledgerfox-1", "c")], history: [], mortal: false }), /hearttree_squad_size_invalid/);

    const valid = generateHearttreeExpedition({ seed: "hearttree:tamper", squad: [grove], history: [], mortal: false });
    const tampered = {
      ...valid,
      chambers: valid.chambers.map((chamber, index) => index === 0
        ? { ...chamber, routes: chamber.routes.map((route) => ({ ...route, requires: ["traversal:impossible"] })) }
        : chamber.routes.length ? { ...chamber, routes: chamber.routes.map((route) => ({ ...route, requires: ["traversal:impossible"] })) } : chamber)
    } as HearttreeExpeditionDefinition;
    assert.equal(validateHearttreeSolvability(tampered, [grove]).ok, false);
  });
});
