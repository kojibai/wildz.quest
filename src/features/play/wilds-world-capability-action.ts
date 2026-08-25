import { canonicalPortableCardJson, sha256PortableBasis } from "./portable-card";
import type { WildsCapabilityContext } from "./wilds-world-capability-context";
import type { WildsWorldCapabilityFamily } from "./wilds-world-capability-registry";

export type WildsCapabilityRequest = Readonly<{
  family: WildsWorldCapabilityFamily;
  assetId: string;
}>;

export type WildsCapabilityRequestResult =
  | Readonly<{ kind: "immediate"; family: WildsWorldCapabilityFamily; assetId: string; targetId: string | null }>
  | Readonly<{ kind: "sustained"; family: WildsWorldCapabilityFamily; assetId: string; active: boolean; targetId: string | null }>
  | Readonly<{ kind: "source-preview"; family: WildsWorldCapabilityFamily; assetId: string; targetId: string; expectedHead: string; idempotencyKey: string }>
  | Readonly<{ kind: "guidance"; family: WildsWorldCapabilityFamily; assetId: string; message: string; targetId: string | null }>
  | Readonly<{ kind: "recovery"; family: WildsWorldCapabilityFamily; assetId: string; message: string }>;

function frozen<T extends object>(value: T): Readonly<T> {
  return Object.freeze(value);
}

export function resolveWildsCapabilityRequest(
  request: WildsCapabilityRequest,
  context: WildsCapabilityContext
): WildsCapabilityRequestResult {
  if (!request.assetId.trim()) throw new Error("wilds_capability_asset_required");
  if (request.family !== context.family) throw new Error("wilds_capability_context_mismatch");
  switch (context.intent.kind) {
    case "execute":
      return frozen({ kind: "immediate", family: request.family, assetId: request.assetId, targetId: context.intent.targetId });
    case "toggle":
      return frozen({ kind: "sustained", family: request.family, assetId: request.assetId, active: context.state !== "active", targetId: context.intent.targetId });
    case "source-preview": {
      if (!context.intent.targetId || !context.intent.expectedHead) {
        return frozen({ kind: "guidance", family: request.family, assetId: request.assetId, message: context.explanation, targetId: context.primaryTargetId });
      }
      const digest = sha256PortableBasis(canonicalPortableCardJson({
        schema: "wildz.capability-request.v1",
        family: request.family,
        assetId: request.assetId,
        targetId: context.intent.targetId,
        expectedHead: context.intent.expectedHead
      }));
      return frozen({
        kind: "source-preview",
        family: request.family,
        assetId: request.assetId,
        targetId: context.intent.targetId,
        expectedHead: context.intent.expectedHead,
        idempotencyKey: `capability:${digest.slice(-32)}`
      });
    }
    case "highlight-route":
      return frozen({ kind: "guidance", family: request.family, assetId: request.assetId, message: context.explanation, targetId: context.primaryTargetId });
    case "explain-recovery":
      return frozen({ kind: "recovery", family: request.family, assetId: request.assetId, message: context.explanation });
  }
}

export type WildsLocallyAdmittedCapabilityTransition = Readonly<{
  transitionId: string;
  sourceHead: string;
  localStatus: "admitted";
}>;

export function completeWildsCapabilityAdmission(
  transition: WildsLocallyAdmittedCapabilityTransition,
  distribution: "offline" | "pending" | "synced"
) {
  if (!transition.transitionId || !transition.sourceHead) throw new Error("wilds_capability_admission_invalid");
  return frozen({
    ...transition,
    distributionStatus: distribution === "synced" ? "synced" as const : "pending" as const
  });
}

