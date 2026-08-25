import { creatureForm } from "./creature-catalog";
import type { KaiTemporalRoot } from "./kai-temporal-root";
import type { PortableCardAsset } from "./portable-card";
import { sha256PortableBasis } from "./portable-card";
import type { WildsCreatureMandateV1 } from "./wilds-creature-mandate";
import type { WildsResourceSource } from "./wilds-resource-authority";
import {
  createWildsMaterialHarvest,
  createWildsStewardHarvestOperation,
  createWildsStewardPhiAward,
  initialWildsHarvestedSourceState,
  projectWildsCreatureWorkFamilies
} from "./wilds-steward-construction";
import { admitWildsEmission, previewWildsEmission } from "./wilds-world-emission";
import type { WildsWorldCommand } from "./wilds-world-service";
import { initialWildsWorldProjection, type WildsWorldProjection } from "./wilds-world-state";
import { wildsWorldSourceEmission, wildsWorldSourceGenesis } from "./wilds-world-genesis";

export { WILDS_WORLD_GENESIS_PULSE } from "./wilds-world-genesis";

/**
 * The deterministic source proof that exists before any network projection
 * arrives. A shared snapshot may extend this state, but cannot be required to
 * authorize work the local source already admits.
 */
export function createWildsSourceAuthorityProjection(): WildsWorldProjection {
  const projection = initialWildsWorldProjection();
  const genesis = wildsWorldSourceGenesis();
  return {
    ...projection,
    groves: Object.fromEntries(genesis.groves.map((grove) => [grove.groveId, grove])),
    worldEmission: genesis.emission
  };
}

type MaterialHarvestCommand = Extract<WildsWorldCommand, { type: "resource.material.harvest" }>;

export function planWildsMaterialHarvest(input: Readonly<{
  projection: WildsWorldProjection;
  source: WildsResourceSource;
  actorId: string;
  actorPosition: { x: number; z: number };
  kaiUPulse: number;
  commandId: string;
  card?: PortableCardAsset | null;
  mandate?: WildsCreatureMandateV1;
  kai?: KaiTemporalRoot;
}>): MaterialHarvestCommand {
  const currentEmission = wildsWorldSourceEmission(input.projection);
  const currentSource = input.projection.harvestedSources[input.source.sourceId]
    ?? initialWildsHarvestedSourceState(input.source);
  const creatureSubjectId = input.card
    ? `creature:${sha256PortableBasis(input.card.id).slice(0, 32)}`
    : undefined;
  const creatureHead = input.card ? sha256PortableBasis(input.card.proof.digest) : undefined;
  const element = input.card ? creatureForm(input.card.manifest.formId)?.element ?? "" : "";
  const toolId = input.projection.equippedStewardTools[input.actorId];
  const tool = toolId ? input.projection.stewardTools[toolId] : null;
  const matchingTool = tool?.capability === input.source.requirements.creature && tool.durability.remaining > 0
    ? tool
    : null;
  const harvested = createWildsMaterialHarvest({
    source: input.source,
    current: currentSource,
    ownerReceizId: input.actorId,
    actorPosition: input.actorPosition,
    creature: creatureSubjectId && creatureHead
      ? { subjectId: creatureSubjectId, head: creatureHead, workFamilies: projectWildsCreatureWorkFamilies(element), willing: true }
      : undefined,
    tool: matchingTool,
    kaiUPulse: input.kaiUPulse
  });
  const operation = createWildsStewardHarvestOperation({
    source: input.source,
    currentSource,
    harvestedSource: harvested.source,
    lot: harvested.lot,
    ownerReceizId: input.actorId,
    playerHead: sha256PortableBasis(input.actorId),
    ...(creatureSubjectId && creatureHead ? { creatureSubjectId, creatureHead } : {}),
    tool: matchingTool,
    nextTool: harvested.tool,
    kaiUPulse: input.kaiUPulse
  });
  const preview = previewWildsEmission({ emission: currentEmission, operation, contributionClass: "construction" });
  if (!preview.eligible || preview.amountPhiMicro === "0") {
    return {
      type: "resource.material.harvest",
      source: input.source,
      sourceHead: currentSource.head,
      actorPosition: input.actorPosition,
      ...(matchingTool ? { toolId: matchingTool.toolId } : {}),
      ...(input.mandate ? { mandate: input.mandate } : {}),
      operation,
      ...(input.card ? { cardProofDigest: input.card.proof.digest } : {}),
      ...(input.kai ? { kai: input.kai } : {}),
      commandId: input.commandId
    };
  }
  const emission = admitWildsEmission({ emission: currentEmission, operation, contributionClass: "construction", preview });
  const phiAward = createWildsStewardPhiAward({
    ownerReceizId: input.actorId,
    operation,
    currentEmission,
    nextEmission: emission,
    amountPhiMicro: preview.amountPhiMicro
  });
  return {
    type: "resource.material.harvest",
    source: input.source,
    sourceHead: currentSource.head,
    actorPosition: input.actorPosition,
    ...(matchingTool ? { toolId: matchingTool.toolId } : {}),
    ...(input.mandate ? { mandate: input.mandate } : {}),
    operation,
    emission,
    amountPhiMicro: preview.amountPhiMicro,
    phiAward,
    ...(input.card ? { cardProofDigest: input.card.proof.digest } : {}),
    ...(input.kai ? { kai: input.kai } : {}),
    commandId: input.commandId
  };
}
