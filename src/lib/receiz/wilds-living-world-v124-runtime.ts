import "server-only";

import {
  ReceizExecutionZeroWriteErrorV124,
  deriveReceizRegisteredOperationCasV124,
  planAtomicOperationV124,
  planReceizValueIntentV122,
  planReceizWorldCommandV122,
  planReceizWorldTransactionV122,
  type ReceizExecutionOutcomeV124,
  type ReceizRegisteredOperationBasisV124,
  type ReceizRegisteredOperationV124
} from "@receiz/sdk";
import type { WildsLivingOperationPlanV1 } from "@/features/play/wilds-living-operation";
import { WILDZ_RECEIZ_APPLICATION_ID } from "./wildz-application";

type HeadCoordinate = Readonly<{ id: string; current: string; next: string }>;
type RuntimeHeads = Readonly<{
  world: HeadCoordinate;
  emission: HeadCoordinate & Readonly<{ sourceProofObjectId: string }>;
  player: HeadCoordinate;
  creature: HeadCoordinate;
  inventory: HeadCoordinate;
}>;

export type WildsLivingWorldV124Rail = Readonly<{
  openAuthoritySessionV124(input: unknown): Promise<unknown>;
  closeAuthoritySessionV124(input: unknown): Promise<unknown>;
  stageExecutionV124(plan: unknown): Promise<unknown>;
  executeV124(handle: unknown, session: unknown): Promise<unknown>;
  resolveExecutionByIdempotencyV124(input: unknown): Promise<unknown>;
}>;

export type WildsLivingWorldV124RuntimeInput = Readonly<{
  rail: WildsLivingWorldV124Rail;
  authoritySessionInput: unknown;
  operation: WildsLivingOperationPlanV1;
  heads: RuntimeHeads;
  amountPhiMicro: string;
  registryDigest: string;
  reducerDigest: string;
  usdPerPhiMicrocents: string;
  priceBasis: unknown;
  attemptId: string;
}>;

const DIGEST = /^[a-f0-9]{64}$/;
const PHI = /^(?:0|[1-9][0-9]{0,29})$/;
const OPERATION_KIND = "receiz.atomic-operation.v124";

function rawHead(value: string) {
  const head = value.replace(/^sha256:/, "");
  if (!DIGEST.test(head)) throw new Error("wilds_living_world_head_invalid");
  return head;
}

function sortedRecord(entries: readonly (readonly [string, string])[]) {
  return Object.fromEntries([...entries].sort(([left], [right]) => left.localeCompare(right)));
}

async function worldPrimitive(
  input: WildsLivingWorldV124RuntimeInput,
  category: "world" | "subject" | "inventory",
  commandKind: string
): Promise<ReceizRegisteredOperationBasisV124> {
  const participantHeads = sortedRecord([
    [input.heads.creature.id, rawHead(input.heads.creature.current)],
    [input.heads.emission.id, rawHead(input.heads.emission.current)],
    [input.heads.inventory.id, rawHead(input.heads.inventory.current)],
    [input.heads.player.id, rawHead(input.heads.player.current)]
  ]);
  const participantSubjectIds = Object.keys(participantHeads);
  const command = await planReceizWorldCommandV122({
    commandId: `${input.operation.operationId}:${category}`,
    worldId: input.heads.world.id,
    expectedWorldHead: rawHead(input.heads.world.current),
    actorSubjectId: input.heads.player.id,
    participantSubjectIds,
    causalParents: [rawHead(input.operation.planDigest)],
    command: {
      kind: commandKind,
      operationPlanDigest: input.operation.planDigest,
      operationId: input.operation.operationId,
      expectedSuccessorHeads: sortedRecord(Object.values(input.heads).map((coordinate) => [coordinate.id, rawHead(coordinate.next)] as const))
    },
    authority: { schema: "wildz.source-proof-authority.v1", strongerTruth: "sealed-receiz-proof-object" },
    mandateDigest: category === "subject" ? rawHead(input.operation.planDigest) : null
  });
  const transaction = await planReceizWorldTransactionV122({
    worldId: input.heads.world.id,
    expectedWorldHead: rawHead(input.heads.world.current),
    participantHeads,
    commands: [command],
    registryDigest: input.registryDigest,
    reducerDigest: input.reducerDigest,
    idempotencyKey: `${input.operation.semanticIdempotencyKey}:${category}`
  });
  return {
    operationId: `${input.operation.operationId}:${category}`,
    category,
    domainId: input.heads.world.id,
    registryDigest: input.registryDigest,
    reducerDigest: input.reducerDigest,
    payload: transaction
  };
}

async function registeredOperation(basis: ReceizRegisteredOperationBasisV124): Promise<ReceizRegisteredOperationV124> {
  const cas = await deriveReceizRegisteredOperationCasV124(basis);
  return { ...basis, participants: cas.participants };
}

function operationCommandKinds(operation: WildsLivingOperationPlanV1) {
  const kind = String(operation.intention.kind ?? "");
  if (kind === "steward.harvest-timber" || kind === "steward.harvest-stone") return {
    world: "resource.material_harvested",
    subject: "subject.steward.work",
    inventory: "inventory.material.admit"
  } as const;
  if (kind === "steward.build-trail-shelter" || kind === "steward.build-trail-bridge") return {
    world: "structure.built",
    subject: "subject.steward.work",
    inventory: "inventory.material.consume"
  } as const;
  if (kind.startsWith("grove.")) return {
    world: "grove.operation.admit",
    subject: "subject.grove.work",
    inventory: "inventory.grove.material"
  } as const;
  throw new Error("wilds_living_world_operation_kind_invalid");
}

async function compileOperations(input: WildsLivingWorldV124RuntimeInput) {
  const commandKinds = operationCommandKinds(input.operation);
  const bases: ReceizRegisteredOperationBasisV124[] = [
    await worldPrimitive(input, "world", commandKinds.world),
    await worldPrimitive(input, "subject", commandKinds.subject),
    await worldPrimitive(input, "inventory", commandKinds.inventory)
  ];
  if (input.amountPhiMicro !== "0") {
    const valueIntent = await planReceizValueIntentV122({
      rail: "settlement",
      amountPhiMicro: input.amountPhiMicro,
      sourceProofObjectId: input.heads.emission.sourceProofObjectId,
      sourceValueHead: rawHead(input.heads.emission.current),
      destinationSubjectId: input.heads.player.id,
      expectedDestinationHead: rawHead(input.heads.player.current),
      usdPerPhiMicrocents: input.usdPerPhiMicrocents,
      priceBasis: input.priceBasis,
      idempotencyKey: input.operation.semanticIdempotencyKey
    });
    bases.push({
      operationId: `${input.operation.operationId}:settlement`,
      category: "settlement",
      domainId: input.heads.world.id,
      registryDigest: input.registryDigest,
      reducerDigest: input.reducerDigest,
      payload: valueIntent
    });
  }
  bases.sort((left, right) => left.operationId.localeCompare(right.operationId));
  const operations = await Promise.all(bases.map(registeredOperation));
  const heads = new Map<string, string>();
  for (let index = 0; index < bases.length; index += 1) {
    const cas = await deriveReceizRegisteredOperationCasV124(bases[index]!);
    for (const [participant, head] of Object.entries(cas.expectedParticipantHeads)) {
      const prior = heads.get(participant);
      if (prior !== undefined && prior !== head) throw new Error("wilds_living_world_cas_conflict");
      heads.set(participant, head);
    }
  }
  return {
    operations,
    participants: [...heads.keys()].sort((left, right) => left.localeCompare(right)),
    expectedParticipantHeads: sortedRecord([...heads.entries()])
  };
}

function outcomeRecord(value: unknown) {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("wilds_living_world_outcome_invalid");
  return value as Partial<ReceizExecutionOutcomeV124> & Record<string, unknown>;
}

function admitOutcome(value: unknown, input: WildsLivingWorldV124RuntimeInput, exactPlanDigest: unknown) {
  const outcome = outcomeRecord(value);
  if (outcome.status === "zero-write" || outcome.status === "cancelled") {
    return Object.freeze({ status: "zero-write" as const, reasonCode: outcome.reasonCode, writes: 0 as const });
  }
  if (outcome.status !== "committed") return null;
  if (outcome.exactPlanDigest !== exactPlanDigest || outcome.semanticIdempotencyKey !== input.operation.semanticIdempotencyKey) {
    throw new Error("wilds_living_world_receipt_mismatch");
  }
  const committedHeads = outcomeRecord(outcome.committedHeads).valueOf() as Record<string, unknown>;
  for (const coordinate of Object.values(input.heads)) {
    if (committedHeads[coordinate.id] !== rawHead(coordinate.next)) throw new Error("wilds_living_world_committed_heads_mismatch");
  }
  return Object.freeze({ status: "committed" as const, committedHeads: outcome.committedHeads as Readonly<Record<string, string>> });
}

export async function executeWildsLivingWorldV124(input: WildsLivingWorldV124RuntimeInput) {
  if (!PHI.test(input.amountPhiMicro) || !DIGEST.test(input.registryDigest) || !DIGEST.test(input.reducerDigest)) {
    throw new Error("wilds_living_world_runtime_input_invalid");
  }
  const compiled = await compileOperations(input);
  const plan = await planAtomicOperationV124({
    applicationId: WILDZ_RECEIZ_APPLICATION_ID,
    operations: compiled.operations,
    participants: compiled.participants,
    expectedParticipantHeads: compiled.expectedParticipantHeads,
    semanticIdempotencyKey: input.operation.semanticIdempotencyKey,
    attemptId: input.attemptId
  });
  let session: unknown = null;
  try {
    session = await input.rail.openAuthoritySessionV124(input.authoritySessionInput);
    let handle: Record<string, unknown>;
    try {
      handle = await input.rail.stageExecutionV124(plan) as Record<string, unknown>;
    } catch (cause) {
      if (!(cause instanceof ReceizExecutionZeroWriteErrorV124)) throw cause;
      // Stage can report STALE_HEAD/ALREADY_COMMITTED when the first exact
      // attempt landed remotely but its response was lost. The zero-write is
      // not sufficient to classify the semantic operation; resolve the exact
      // key and admit only a receipt bound to this plan and its successors.
      const resolved = await input.rail.resolveExecutionByIdempotencyV124({
        applicationId: WILDZ_RECEIZ_APPLICATION_ID,
        domainId: plan.domainId,
        operationKind: plan.operationKind,
        semanticIdempotencyKey: input.operation.semanticIdempotencyKey
      });
      const admitted = admitOutcome(resolved, input, plan.exactPlanDigest);
      return admitted ?? Object.freeze({ status: "unknown" as const });
    }
    let outcome: unknown;
    try {
      outcome = await input.rail.executeV124(handle, session);
    } catch (cause) {
      if (cause instanceof ReceizExecutionZeroWriteErrorV124) {
        outcome = { status: "zero-write", reasonCode: cause.failure.reasonCode, writes: 0 };
      } else {
        outcome = await input.rail.resolveExecutionByIdempotencyV124({
          applicationId: WILDZ_RECEIZ_APPLICATION_ID,
          domainId: plan.domainId,
          operationKind: plan.operationKind,
          semanticIdempotencyKey: input.operation.semanticIdempotencyKey
        });
      }
    }
    let admitted = admitOutcome(outcome, input, plan.exactPlanDigest);
    if (admitted?.status === "committed") return admitted;
    // A stale head is also the normal response to a retry whose first request
    // committed but whose receipt was lost. Resolve the exact semantic key
    // before accepting zero-write as terminal.
    outcome = await input.rail.resolveExecutionByIdempotencyV124({
      applicationId: WILDZ_RECEIZ_APPLICATION_ID,
      domainId: plan.domainId,
      operationKind: plan.operationKind,
      semanticIdempotencyKey: input.operation.semanticIdempotencyKey
    });
    admitted = admitOutcome(outcome, input, plan.exactPlanDigest);
    if (!admitted) return Object.freeze({ status: "unknown" as const });
    return admitted;
  } finally {
    if (session) {
      const authoritySessionHandle = typeof session === "object" && session !== null
        ? (session as Record<string, unknown>).authoritySessionHandle
        : undefined;
      await input.rail.closeAuthoritySessionV124({
        applicationId: WILDZ_RECEIZ_APPLICATION_ID,
        authoritySessionHandle,
        persistedSession: session
      }).catch(() => undefined);
    }
  }
}
