import { canonicalPortableCardJson, sha256PortableBasis } from "./portable-card";
import { verifyWildsLivingOperationPlan, type WildsLivingOperationPlanV1 } from "./wilds-living-operation";

export type WildsResourceLotKind = "living-honey";

export type WildsResourceLotV1 = Readonly<{
  schema: "wildz.resource-lot.v1";
  lotId: string;
  kind: WildsResourceLotKind;
  quantity: number;
  quality: 1 | 2 | 3 | 4 | 5;
  ownerReceizId: string;
  source: Readonly<{
    groveId: string;
    groveSourceHead: string;
    groveAdmittedHead: string;
    operationId: string;
    operationPlanDigest: string;
    kaiUPulse: number;
  }>;
  revision: 0;
  parentHead: null;
  transferable: true;
  authority: "source-proof-objects";
  head: string;
}>;

type GroveLotCoordinate = Readonly<{
  groveId: string;
  head: string;
  honey: number;
}>;

type GroveLotInput = Readonly<{
  operation: WildsLivingOperationPlanV1;
  ownerReceizId: string;
  sourceGrove: GroveLotCoordinate;
  admittedGrove: GroveLotCoordinate & Readonly<{ parentHead: string | null }>;
}>;

const ID = /^[a-z0-9][a-z0-9._:-]{0,159}$/;
const HEAD = /^sha256:[a-f0-9]{64}$/;

function freeze<T>(value: T): T {
  if (value && typeof value === "object" && !Object.isFrozen(value)) {
    Object.freeze(value);
    for (const child of Object.values(value as Record<string, unknown>)) freeze(child);
  }
  return value;
}

function digest(value: unknown) {
  return sha256PortableBasis(canonicalPortableCardJson(value));
}

function basisFor(input: GroveLotInput) {
  if (!verifyWildsLivingOperationPlan(input.operation).ok) throw new Error("wilds_resource_lot_operation_invalid");
  if (input.operation.intention.kind !== "grove.harvest-honey") return null;
  const owner = input.operation.participants.find((participant) => participant.kind === "player" && participant.id === input.ownerReceizId);
  if (!owner || !ID.test(input.ownerReceizId)) throw new Error("wilds_resource_lot_owner_invalid");
  if (input.operation.intention.featureId !== input.sourceGrove.groveId
    || input.sourceGrove.groveId !== input.admittedGrove.groveId
    || !ID.test(input.sourceGrove.groveId)
    || !HEAD.test(input.sourceGrove.head)
    || !HEAD.test(input.admittedGrove.head)
    || input.admittedGrove.parentHead !== input.sourceGrove.head) {
    throw new Error("wilds_resource_lot_source_invalid");
  }
  if (!Number.isSafeInteger(input.sourceGrove.honey) || !Number.isSafeInteger(input.admittedGrove.honey)
    || input.sourceGrove.honey < 1 || input.admittedGrove.honey !== input.sourceGrove.honey - 1) {
    throw new Error("wilds_resource_lot_conservation_invalid");
  }
  const identityDigest = digest({
    schema: "wildz.resource-lot-identity.v1",
    kind: "living-honey",
    ownerReceizId: input.ownerReceizId,
    groveId: input.sourceGrove.groveId,
    operationPlanDigest: input.operation.planDigest
  }).replace(/^sha256:/, "");
  const quality = Math.max(1, Math.min(5, 1 + Math.floor(input.operation.netContribution / 3))) as 1 | 2 | 3 | 4 | 5;
  return {
    schema: "wildz.resource-lot.v1" as const,
    lotId: `wildz:resource:living-honey:${identityDigest}`,
    kind: "living-honey" as const,
    quantity: 1,
    quality,
    ownerReceizId: input.ownerReceizId,
    source: {
      groveId: input.sourceGrove.groveId,
      groveSourceHead: input.sourceGrove.head,
      groveAdmittedHead: input.admittedGrove.head,
      operationId: input.operation.operationId,
      operationPlanDigest: input.operation.planDigest,
      kaiUPulse: input.operation.kaiUPulse
    },
    revision: 0 as const,
    parentHead: null,
    transferable: true as const,
    authority: "source-proof-objects" as const
  };
}

export function createWildsGroveResourceLot(input: GroveLotInput): WildsResourceLotV1 | null {
  const basis = basisFor(input);
  return basis ? freeze({ ...basis, head: digest(basis) }) : null;
}

export function verifyWildsResourceLot(value: unknown): value is WildsResourceLotV1 {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const lot = value as Partial<WildsResourceLotV1>;
  if (lot.schema !== "wildz.resource-lot.v1" || lot.kind !== "living-honey" || lot.quantity !== 1
    || !Number.isSafeInteger(lot.quality) || (lot.quality ?? 0) < 1 || (lot.quality ?? 0) > 5
    || typeof lot.ownerReceizId !== "string" || !ID.test(lot.ownerReceizId)
    || typeof lot.lotId !== "string" || !/^wildz:resource:living-honey:[a-f0-9]{64}$/.test(lot.lotId)
    || lot.revision !== 0 || lot.parentHead !== null || lot.transferable !== true
    || lot.authority !== "source-proof-objects" || typeof lot.head !== "string" || !HEAD.test(lot.head)
    || !lot.source || typeof lot.source !== "object") return false;
  const source = lot.source;
  if (!ID.test(source.groveId) || !HEAD.test(source.groveSourceHead) || !HEAD.test(source.groveAdmittedHead)
    || !ID.test(source.operationId) || !/^(?:sha256:)?[a-f0-9]{64}$/.test(source.operationPlanDigest)
    || !Number.isSafeInteger(source.kaiUPulse) || source.kaiUPulse < 0) return false;
  const { head, ...basis } = lot as WildsResourceLotV1;
  return head === digest(basis);
}
