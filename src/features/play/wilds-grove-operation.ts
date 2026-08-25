import type { WildsCreatureMandateV1 } from "./wilds-creature-mandate";
import { compileWildsLivingOperation, type WildsLivingOperationPlanV1 } from "./wilds-living-operation";
import type { WildsRegionalWeather } from "./wilds-regional-weather";

export type WildsGroveActionKind =
  | "observe" | "gather" | "pollinate" | "sow" | "water"
  | "compost" | "cultivate" | "transform-nectar" | "harvest-honey"
  | "build-hive" | "build-nursery" | "repair";

export type WildsGroveMaterialDeltas = Readonly<{
  pollen: number;
  seeds: number;
  fallenFiber: number;
  nectar: number;
  honey: number;
}>;

export type WildsGroveOperationEffectsV1 = Readonly<{
  materials: WildsGroveMaterialDeltas;
  ecology: Readonly<{ soil: number; moisture: number; maturity: number; flowers: number; pollinators: number; nourishment: number }>;
  structures: Readonly<{ hive: number; nursery: number }>;
  observe: boolean;
  discovery: string | null;
}>;

type GroveOperationInput = Readonly<{
  grove: Readonly<{
    groveId: string;
    regionId: string;
    head: string;
    materials: Readonly<{ pollen: number; seeds: number; fallenFiber: number; nectar: number; honey: number }>;
    structures: Readonly<{ hive: number; nursery: number }>;
  }>;
  action: WildsGroveActionKind;
  actor: Readonly<{ id: string; head: string }>;
  mandate?: WildsCreatureMandateV1;
  weather: WildsRegionalWeather;
  kaiUPulse: number;
}>;

const zeroMaterials = () => ({ pollen: 0, seeds: 0, fallenFiber: 0, nectar: 0, honey: 0 });
const zeroEcology = () => ({ soil: 0, moisture: 0, maturity: 0, flowers: 0, pollinators: 0, nourishment: 0 });

export function compileWildsGroveOperation(input: GroveOperationInput): Readonly<{
  operation: WildsLivingOperationPlanV1;
  effects: WildsGroveOperationEffectsV1;
}> {
  const materials = zeroMaterials();
  const ecology = zeroEcology();
  const structures = { hive: 0, nursery: 0 };
  let observe = false;
  let discovery: string | null = null;
  const contribution = {
    usefulOutput: 0, ecologicalRenewal: 0, publicBenefit: 0, cooperation: 0, durability: 0,
    extraction: 0, damage: 0, waste: 0, restorationDebt: 0
  };

  switch (input.action) {
    case "observe": observe = true; break;
    case "gather":
      materials.pollen += 2; materials.seeds += 1; materials.fallenFiber += 2;
      contribution.usefulOutput = 1;
      break;
    case "pollinate":
      materials.pollen -= 1; materials.nectar += 2;
      ecology.flowers += Math.max(1, Math.round(input.weather.pollinationMultiplier * 2));
      ecology.pollinators += 1;
      contribution.ecologicalRenewal = 5; contribution.publicBenefit = 1; contribution.cooperation = 2;
      break;
    case "sow":
      materials.seeds -= 1; ecology.flowers += 2; ecology.soil += 1; ecology.maturity += 1;
      contribution.ecologicalRenewal = 3; contribution.durability = 1;
      break;
    case "water": ecology.moisture += 2; contribution.ecologicalRenewal = 1; break;
    case "compost": ecology.soil += 2; contribution.ecologicalRenewal = 2; break;
    case "cultivate": ecology.maturity += 2; contribution.ecologicalRenewal = 2; break;
    case "transform-nectar":
      materials.nectar -= 2; materials.honey += 2; contribution.usefulOutput = 2;
      break;
    case "build-hive":
      materials.fallenFiber -= 2; structures.hive += 1;
      contribution.publicBenefit = 2; contribution.durability = 3; contribution.cooperation = 1;
      break;
    case "build-nursery":
      materials.fallenFiber -= 2; structures.nursery += 1;
      contribution.ecologicalRenewal = 2; contribution.publicBenefit = 2; contribution.durability = 3;
      break;
    case "harvest-honey":
      materials.honey -= 1; ecology.nourishment += 2; contribution.usefulOutput = 2;
      if (input.grove.materials.honey <= 1) contribution.restorationDebt = 3;
      discovery = "discovery:living-honey";
      break;
    case "repair": contribution.durability = 2; break;
  }

  const creature = input.mandate ? [{
    id: input.mandate.creatureSubjectId,
    kind: "creature" as const,
    expectedHead: input.mandate.creatureHead,
    role: input.action
  }] : [];
  const participantIds = [input.actor.id, ...creature.map((entry) => entry.id)];
  const operation = compileWildsLivingOperation({
    operationId: `${input.grove.groveId}:${input.action}:${input.kaiUPulse}`,
    category: input.action === "build-hive" || input.action === "build-nursery" || input.action === "repair" ? "construction" : "ecology",
    intention: { kind: `grove.${input.action}`, regionId: input.grove.regionId, featureId: input.grove.groveId },
    participants: [
      { id: input.actor.id, kind: "player", expectedHead: input.actor.head, role: "steward" },
      ...creature,
      { id: input.grove.groveId, kind: "world", expectedHead: input.grove.head, role: "living-grove" }
    ],
    stages: [{ id: `stage:${input.action}`, profession: input.action, participantIds }],
    consequences: contribution,
    kaiUPulse: input.kaiUPulse,
    expiresAtKaiUPulse: input.kaiUPulse + 10_000_000,
    semanticIdempotencyKey: `wildz:${input.grove.groveId}:${input.action}:${input.kaiUPulse}`
  });
  return Object.freeze({
    operation,
    effects: Object.freeze({
      materials: Object.freeze(materials),
      ecology: Object.freeze(ecology),
      structures: Object.freeze(structures),
      observe,
      discovery
    })
  });
}
