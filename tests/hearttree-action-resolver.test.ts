import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { hearttreeAbilitiesFor } from "../src/features/play/hearttree/ability-registry";
import { resolveHearttreeAction, type HearttreeActionContext } from "../src/features/play/hearttree/action-resolver";
import { emptyHearttreeCondition, projectHearttreeCard, type HearttreeCardCapability } from "../src/features/play/hearttree/card-capability";
import { creatureForm } from "../src/features/play/creature-catalog";
import { sealCollectedCard } from "../src/features/play/portable-card";

function capability(formId: string, encounterId = formId): HearttreeCardCapability {
  const source = sealCollectedCard({
    formId,
    ownerReceizId: "hearttree.player",
    encounterId: `resolver:${encounterId}`,
    capturedAt: "2026-07-16T13:00:00.000Z"
  });
  return projectHearttreeCard(source, emptyHearttreeCondition(source.id));
}

function context(actor: HearttreeCardCapability, input: Partial<HearttreeActionContext> = {}): HearttreeActionContext {
  return {
    kind: "ability",
    actor,
    abilityId: hearttreeAbilitiesFor(actor)[0]!.id,
    stamina: 100,
    cooldownRemainingMs: 0,
    distance: 1.5,
    lineOfSight: true,
    timing: { pressedAtMs: 500, windowStartMs: 400, windowEndMs: 700 },
    target: { id: "root-master", element: "Grove", guard: 40, exposed: false },
    environment: { obstacle: "none", element: "Grove" },
    ...input
  };
}

describe("Hearttree real ability registry", () => {
  it("preserves the card's actual catalog ability names and power", () => {
    const actor = capability("voltray-1");
    const abilities = hearttreeAbilitiesFor(actor);
    const form = creatureForm(actor.formId)!;

    assert.deepEqual(abilities.map((ability) => ability.sourceName), actor.abilityNames);
    assert.deepEqual(abilities.map((ability) => ability.power), form.abilities.map((ability) => ability.power));
    assert.equal(abilities[0]?.element, "Spark");
    assert.equal(abilities[0]?.tags.includes("energize"), true);
    assert.equal(abilities[1]?.tags.includes("support"), true);
  });

  it("fails closed when a pinned ability name no longer matches the catalog", () => {
    const actor = capability("mintcub-1");
    const changed = { ...actor, abilityNames: ["Unknown Power", actor.abilityNames[1]] as [string, string] };
    assert.throws(() => hearttreeAbilitiesFor(changed), /hearttree_ability_unknown/);
  });
});

describe("Hearttree deterministic action resolution", () => {
  it("uses real speed to create a larger dodge margin", () => {
    const fast = capability("voltray-1", "fast");
    const slow = capability("mintcub-1", "slow");
    const fastOutcome = resolveHearttreeAction(context(fast, { kind: "dodge", abilityId: null }));
    const slowOutcome = resolveHearttreeAction(context(slow, { kind: "dodge", abilityId: null }));

    assert.ok(fast.stats.speed > slow.stats.speed);
    assert.ok(fastOutcome.margin > slowOutcome.margin);
  });

  it("lets actual Stone armor break a root wall while an unprepared card fails", () => {
    const stone = capability("titanseal-1", "stone");
    const grove = capability("mintcub-1", "grove");
    const obstacle = { obstacle: "root-wall" as const, element: "Grove" };
    const stoneOutcome = resolveHearttreeAction(context(stone, { kind: "environment", abilityId: null, environment: obstacle }));
    const groveOutcome = resolveHearttreeAction(context(grove, { kind: "environment", abilityId: null, environment: obstacle }));

    assert.equal(stoneOutcome.success, true);
    assert.equal(stoneOutcome.effects.some((effect) => effect.kind === "break"), true);
    assert.equal(groveOutcome.success, false);
  });

  it("makes player timing, position, stamina, and cooldown real requirements", () => {
    const actor = capability("voltray-1", "requirements");
    assert.equal(resolveHearttreeAction(context(actor)).success, true);
    assert.equal(resolveHearttreeAction(context(actor, { distance: 99 })).success, false);
    assert.equal(resolveHearttreeAction(context(actor, { stamina: 0 })).success, false);
    assert.equal(resolveHearttreeAction(context(actor, { cooldownRemainingMs: 1 })).success, false);
    assert.equal(resolveHearttreeAction(context(actor, { timing: { pressedAtMs: 900, windowStartMs: 400, windowEndMs: 700 } })).success, false);
    assert.equal(resolveHearttreeAction(context(actor, { kind: "dodge", abilityId: null, stamina: 0 })).failure, "stamina");
    assert.equal(resolveHearttreeAction(context(actor, { kind: "guard", abilityId: null, stamina: 0 })).failure, "stamina");
  });

  it("returns the same effects and explanation for identical canonical inputs", () => {
    const actor = capability("voltray-1", "determinism");
    const input = context(actor, { target: { id: "root-master", element: "Tide", guard: 55, exposed: true } });
    assert.deepEqual(resolveHearttreeAction(input), resolveHearttreeAction(input));
    assert.ok(resolveHearttreeAction(input).explanation.some((entry) => entry.factor === "timing"));
    assert.ok(resolveHearttreeAction(input).explanation.some((entry) => entry.factor === "element"));
  });
});
