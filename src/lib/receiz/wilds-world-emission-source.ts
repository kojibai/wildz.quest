import type { WildsLivingOperationPlanV1 } from "@/features/play/wilds-living-operation";
import { canonicalPortableCardJson, sha256PortableBasis } from "@/features/play/portable-card";
import type { WildsRegenerativeGroveV1 } from "@/features/play/wilds-regenerative-grove";
import type { WildsWorldCheckpoint } from "@/features/play/wilds-world-state";
import type { WildsWorldEmissionProofV1 } from "@/features/play/wilds-world-emission";

export const WILDS_LIVING_WORLD_REGISTRY_DIGEST = sha256PortableBasis("wildz.living-world.registry.v1");
export const WILDS_LIVING_WORLD_REDUCER_DIGEST = sha256PortableBasis("wildz.living-world.reducer.v1");

export function wildsWorldEmissionValueSource(input: Readonly<{
  emission: WildsWorldEmissionProofV1;
  sourceProofObjectId: string;
}>) {
  if (!input.sourceProofObjectId.trim()) throw new Error("wilds_world_emission_source_invalid");
  return Object.freeze({
    sourceProofObjectId: input.sourceProofObjectId,
    sourceValueHead: input.emission.head.replace(/^sha256:/, ""),
    authority: "world-emission-proof-object" as const
  });
}

function digest(value: unknown) {
  return sha256PortableBasis(canonicalPortableCardJson(value));
}

export function wildsLivingWorldSuccessorHeads(input: Readonly<{
  actorId: string;
  operation: WildsLivingOperationPlanV1;
  currentCheckpoint: WildsWorldCheckpoint;
  nextCheckpoint: WildsWorldCheckpoint;
  currentEmission: WildsWorldEmissionProofV1;
  nextEmission: WildsWorldEmissionProofV1;
  currentGrove: WildsRegenerativeGroveV1;
  nextGrove: WildsRegenerativeGroveV1;
}>) {
  const actor = input.operation.participants.find((participant) => participant.id === input.actorId && participant.kind === "player");
  const creature = input.operation.participants.find((participant) => participant.kind === "creature");
  if (!actor || !creature) throw new Error("wilds_living_world_participants_required");
  const inventoryId = `inventory:${input.actorId}`;
  const inventoryCurrent = digest({ schema: "wildz.grove-inventory.v1", ownerId: input.actorId, materials: input.currentGrove.materials });
  return Object.freeze({
    world: Object.freeze({ id: "wilds:global:v3", current: digest(input.currentCheckpoint), next: digest(input.nextCheckpoint) }),
    emission: Object.freeze({
      id: `world-emission:${input.currentEmission.epochId}`,
      current: input.currentEmission.head,
      next: input.nextEmission.head,
      sourceProofObjectId: `proof:world-emission:${input.currentEmission.epochId}`
    }),
    player: Object.freeze({
      id: actor.id,
      current: actor.expectedHead,
      next: digest({ schema: "wildz.player-operation-successor.v1", head: actor.expectedHead, operation: input.operation.planDigest })
    }),
    creature: Object.freeze({
      id: creature.id,
      current: creature.expectedHead,
      next: digest({ schema: "wildz.creature-operation-successor.v1", head: creature.expectedHead, operation: input.operation.planDigest })
    }),
    inventory: Object.freeze({
      id: inventoryId,
      current: inventoryCurrent,
      next: digest({ schema: "wildz.grove-inventory.v1", ownerId: input.actorId, materials: input.nextGrove.materials })
    })
  });
}
