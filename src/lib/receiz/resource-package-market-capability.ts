import type { ResourcePackageMarketHead, ResourcePackageMarketState } from "../../features/market/resource-package-market";

export type ResourcePackageMarketConditionalRail = Readonly<{
  readLatest(input: { namespace: string; schema: string }): Promise<unknown>;
  compareAndAppend(input: { namespace: string; schema: string; expectedHead: ResourcePackageMarketHead; state: ResourcePackageMarketState; idempotencyKey: string }): Promise<unknown>;
  verifyAdmissionProof(input: { namespace: string; schema: string; state: ResourcePackageMarketState | null; proof: unknown }): Promise<boolean>;
}>;
function record(value: unknown): value is Record<string, unknown> { return Boolean(value) && typeof value === "object" && !Array.isArray(value); }

/** A public feed write, mutex or exact readback does not qualify as atomic CAS. */
export function resolveResourcePackageMarketConditionalRail(adapter: unknown): ResourcePackageMarketConditionalRail | null {
  if (!record(adapter)) return null;
  const candidate = record(adapter.wildzResourcePackageMarket) ? adapter.wildzResourcePackageMarket
    : record(adapter.client) && record(adapter.client.wildzResourcePackageMarket) ? adapter.client.wildzResourcePackageMarket : null;
  if (!candidate || typeof candidate.readLatest !== "function" || typeof candidate.compareAndAppend !== "function" || typeof candidate.verifyAdmissionProof !== "function") return null;
  return { readLatest: candidate.readLatest.bind(candidate) as ResourcePackageMarketConditionalRail["readLatest"], compareAndAppend: candidate.compareAndAppend.bind(candidate) as ResourcePackageMarketConditionalRail["compareAndAppend"], verifyAdmissionProof: candidate.verifyAdmissionProof.bind(candidate) as ResourcePackageMarketConditionalRail["verifyAdmissionProof"] };
}
