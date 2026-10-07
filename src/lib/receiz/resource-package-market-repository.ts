import { createHash } from "node:crypto";
import { canonicalPortableCardJson } from "../../features/play/portable-card";
import {
  advanceResourcePackageMarketState,
  emptyResourcePackageMarketState,
  restoreResourcePackageMarketState,
  type ResourcePackageMarketEvent,
  type ResourcePackageMarketHead,
  type ResourcePackageMarketState
} from "../../features/market/resource-package-market";
import { resolveResourcePackageMarketConditionalRail } from "./resource-package-market-capability";
export { resolveResourcePackageMarketConditionalRail, type ResourcePackageMarketConditionalRail } from "./resource-package-market-capability";

export const RESOURCE_PACKAGE_MARKET_NAMESPACE = "wildz:resource-package-market:v1";
const SCHEMA = "receiz.wildz.resource-package-market-projection.v1";
export type ResourcePackageMarketAdmission =
  | { status: "admitted" | "replayed"; state: ResourcePackageMarketState }
  | { status: "market_revision_conflict"; head: ResourcePackageMarketHead }
  | { status: "market_capability_unavailable" };
export interface ResourcePackageMarketRepository {
  load(): Promise<{ status: "ready"; state: ResourcePackageMarketState } | { status: "market_capability_unavailable" }>;
  append(input: { current: ResourcePackageMarketState; event: ResourcePackageMarketEvent; idempotencyKey: string; occurredAt: string }): Promise<ResourcePackageMarketAdmission>;
}
function record(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}
function restored(value: unknown, depth = 0): ResourcePackageMarketState | null {
  if (!record(value) || depth > 6) return null;
  const direct = restoreResourcePackageMarketState(value);
  if (direct) return direct;
  for (const key of ["state", "data", "record", "result", "storeStateRecord"]) {
    const state = restored(value[key], depth + 1);
    if (state) return state;
  }
  if (Array.isArray(value.records)) for (const entry of value.records) {
    const state = restored(entry, depth + 1); if (state) return state;
  }
  return null;
}
export function resourcePackageMarketHead(state: ResourcePackageMarketState): ResourcePackageMarketHead {
  return { revision: state.revision, appendAnchorId: state.appendAnchorId };
}
export function packageMarketHeadMatches(state: ResourcePackageMarketState, head: ResourcePackageMarketHead) {
  return state.revision === head.revision && state.appendAnchorId === head.appendAnchorId;
}
/** Both source custody and market/payment state require native conditional
 * append. SDK publicStore publishing is never an admission fallback. */
export function createResourcePackageMarketRepository(adapter: unknown): ResourcePackageMarketRepository {
  const rail = resolveResourcePackageMarketConditionalRail(adapter);
  const unavailable = { status: "market_capability_unavailable" as const };
  async function verified(response: unknown): Promise<ResourcePackageMarketState | null> {
    if (!rail || !record(response)) return null;
    const absent = response.status === "not_found" && response.state === null;
    const state = absent ? null : restored(response);
    if (!absent && !state || !await rail.verifyAdmissionProof({ namespace: RESOURCE_PACKAGE_MARKET_NAMESPACE, schema: SCHEMA, state, proof: response.admissionProof })) return null;
    return state ?? emptyResourcePackageMarketState();
  }
  async function load(): ReturnType<ResourcePackageMarketRepository["load"]> {
    if (!rail) return unavailable;
    try {
      const state = await verified(await rail.readLatest({ namespace: RESOURCE_PACKAGE_MARKET_NAMESPACE, schema: SCHEMA }));
      return state ? { status: "ready", state } : unavailable;
    } catch { return unavailable; }
  }
  return {
    load,
    async append(input) {
      if (!rail) return unavailable;
      const loaded = await load();
      if (loaded.status !== "ready") return unavailable;
      if (!packageMarketHeadMatches(loaded.state, input.current)) return { status: "market_revision_conflict", head: resourcePackageMarketHead(loaded.state) };
      const reduced = advanceResourcePackageMarketState(input.current, input.event, input.occurredAt);
      const state = { ...reduced, appendAnchorId: `ps:${createHash("sha256").update(RESOURCE_PACKAGE_MARKET_NAMESPACE).update("\0").update(input.idempotencyKey).update("\0").update(canonicalPortableCardJson(reduced)).digest("hex")}` };
      try {
        const response = await rail.compareAndAppend({ namespace: RESOURCE_PACKAGE_MARKET_NAMESPACE, schema: SCHEMA, expectedHead: resourcePackageMarketHead(input.current), state, idempotencyKey: input.idempotencyKey });
        const acknowledged = await verified(response);
        if (!acknowledged) return unavailable;
        if (record(response) && response.status === "conflict") return { status: "market_revision_conflict", head: resourcePackageMarketHead(acknowledged) };
        if (canonicalPortableCardJson(acknowledged) !== canonicalPortableCardJson(state)) return unavailable;
        return { status: record(response) && response.status === "replayed" ? "replayed" : "admitted", state: acknowledged };
      } catch { return unavailable; }
    }
  };
}
