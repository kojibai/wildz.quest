import { canonicalPortableCardJson, sha256PortableBasis } from "../portable-card";

export type ArenaCausalEventKind = "progress" | "retirement" | "ownership";
export type ArenaCausalEventInput = Readonly<{
  id: string; assetId: string; parentDigest: string; occurredAt: string; ownerId: string;
  kind: ArenaCausalEventKind; xp: Readonly<Record<string, number>>; historyIds: readonly string[];
  rewardIds: readonly string[]; resourceDelta: Readonly<Record<string, number>>; injuryIds: readonly string[];
  ownershipTo?: string;
}>;
export type ArenaCausalEvent = ArenaCausalEventInput & Readonly<{ schema: "receiz.wilds.arena_causal_event.v1"; digest: string }>;
export type ArenaMergeInput = Readonly<{
  base: Readonly<{ ownerId: string; resources: Readonly<Record<string, number>>; cardHeadDigests: Readonly<Record<string, string>> }>;
  branches: readonly (readonly ArenaCausalEvent[])[];
}>;
export type ArenaMergeRejection = Readonly<{ eventId: string; digest: string; reason: "event_invalid" | "causal_parent_missing" | "insufficient_resource" | "stale_living_after_retirement" | "ownership_conflict" | "owner_mismatch" }>;
export type ArenaMergeResult = Readonly<{
  admittedDigests: readonly string[]; rejected: readonly ArenaMergeRejection[];
  cardHeadDigests: Readonly<Record<string, readonly string[]>>; xp: Readonly<Record<string, Readonly<Record<string, number>>>>;
  historyIds: readonly string[]; rewardIds: readonly string[]; resources: Readonly<Record<string, number>>;
  injuryIds: Readonly<Record<string, readonly string[]>>; retiredAssetIds: readonly string[];
  ownership: Readonly<Record<string, string>>;
}>;

const digestPattern = /^sha256:[a-f0-9]{64}$/;
const idPattern = /^[a-z0-9:._-]{1,160}$/i;
const eventDigest = (value: Omit<ArenaCausalEvent, "digest">) => sha256PortableBasis(canonicalPortableCardJson(value));

function validateEventInput(input: ArenaCausalEventInput) {
  if (![input.id, input.assetId, input.ownerId].every((value) => idPattern.test(value))
    || !digestPattern.test(input.parentDigest)
    || !Number.isFinite(Date.parse(input.occurredAt))
    || !["progress", "retirement", "ownership"].includes(input.kind)
    || (input.kind === "ownership") !== Boolean(input.ownershipTo && idPattern.test(input.ownershipTo))) throw new Error("arena_causal_event_invalid");
  for (const values of [input.historyIds, input.rewardIds, input.injuryIds]) {
    if (values.length > 512 || values.some((value) => !idPattern.test(value))) throw new Error("arena_causal_event_invalid");
  }
  for (const amount of Object.values(input.xp)) if (!Number.isSafeInteger(amount) || amount < 0 || amount > 1_000_000) throw new Error("arena_causal_event_invalid");
  for (const amount of Object.values(input.resourceDelta)) if (!Number.isSafeInteger(amount) || Math.abs(amount) > 1_000_000) throw new Error("arena_causal_event_invalid");
}

export function createArenaCausalEvent(input: ArenaCausalEventInput): ArenaCausalEvent {
  validateEventInput(input);
  const unsigned = { schema: "receiz.wilds.arena_causal_event.v1" as const, ...input };
  return { ...unsigned, digest: eventDigest(unsigned) };
}

function validEvent(event: ArenaCausalEvent) {
  try {
    const { digest, ...unsigned } = event;
    validateEventInput(event);
    return event.schema === "receiz.wilds.arena_causal_event.v1" && digestPattern.test(digest) && eventDigest(unsigned) === digest;
  } catch { return false; }
}

function uniqueSorted(values: Iterable<string>) { return [...new Set(values)].sort(); }

export function mergeArenaCausalBranches(input: ArenaMergeInput): ArenaMergeResult {
  const events = [...new Map(input.branches.flat().map((event) => [event.digest, event])).values()];
  const rejected = new Map<string, ArenaMergeRejection>();
  const reject = (event: ArenaCausalEvent, reason: ArenaMergeRejection["reason"]) => rejected.set(event.digest, { eventId: event.id, digest: event.digest, reason });
  const candidates = events.filter((event) => validEvent(event) || (reject(event, "event_invalid"), false));
  const ownershipGroups = new Map<string, ArenaCausalEvent[]>();
  for (const event of candidates.filter((item) => item.kind === "ownership")) {
    const key = `${event.assetId}:${event.parentDigest}`;
    ownershipGroups.set(key, [...(ownershipGroups.get(key) ?? []), event]);
  }
  for (const group of ownershipGroups.values()) if (new Set(group.map((event) => event.ownershipTo)).size > 1) for (const event of group) reject(event, "ownership_conflict");

  const known = new Set(Object.values(input.base.cardHeadDigests));
  const ordered: ArenaCausalEvent[] = [];
  const remaining = candidates.filter((event) => !rejected.has(event.digest));
  while (remaining.length) {
    const ready = remaining.filter((event) => known.has(event.parentDigest)).sort((left, right) => left.occurredAt.localeCompare(right.occurredAt) || left.digest.localeCompare(right.digest));
    if (!ready.length) { for (const event of remaining) reject(event, "causal_parent_missing"); break; }
    for (const event of ready) {
      ordered.push(event); known.add(event.digest);
      remaining.splice(remaining.indexOf(event), 1);
    }
  }

  const retirementTime = new Map<string, string>();
  for (const event of ordered) if (event.kind === "retirement" && (!retirementTime.has(event.assetId) || event.occurredAt < retirementTime.get(event.assetId)!)) retirementTime.set(event.assetId, event.occurredAt);
  const resources: Record<string, number> = { ...input.base.resources };
  const xp: Record<string, Record<string, number>> = {};
  const injuries: Record<string, Set<string>> = {};
  const history = new Set<string>(); const rewards = new Set<string>(); const retired = new Set<string>();
  const ownership: Record<string, string> = Object.fromEntries(Object.keys(input.base.cardHeadDigests).map((assetId) => [assetId, input.base.ownerId]));
  const heads: Record<string, Set<string>> = Object.fromEntries(Object.entries(input.base.cardHeadDigests).map(([assetId, head]) => [assetId, new Set([head])]));
  const admitted: ArenaCausalEvent[] = [];
  for (const event of ordered) {
    if (rejected.has(event.digest)) continue;
    if ((ownership[event.assetId] ?? input.base.ownerId) !== event.ownerId) { reject(event, "owner_mismatch"); continue; }
    const deathAt = retirementTime.get(event.assetId);
    if (event.kind !== "retirement" && deathAt && event.occurredAt > deathAt) { reject(event, "stale_living_after_retirement"); continue; }
    if (Object.entries(event.resourceDelta).some(([resource, delta]) => (resources[resource] ?? 0) + delta < 0)) { reject(event, "insufficient_resource"); continue; }
    for (const [resource, delta] of Object.entries(event.resourceDelta)) resources[resource] = (resources[resource] ?? 0) + delta;
    const progress = xp[event.assetId] ??= {};
    if (event.kind === "progress") {
      for (const [track, amount] of Object.entries(event.xp)) progress[track] = Math.min(1_000_000, (progress[track] ?? 0) + amount);
    }
    for (const value of event.historyIds) history.add(value);
    for (const value of event.rewardIds) rewards.add(value);
    const assetInjuries = injuries[event.assetId] ??= new Set();
    for (const value of event.injuryIds) assetInjuries.add(value);
    if (event.kind === "retirement") retired.add(event.assetId);
    if (event.kind === "ownership") ownership[event.assetId] = event.ownershipTo!;
    const assetHeads = heads[event.assetId] ??= new Set();
    assetHeads.delete(event.parentDigest); assetHeads.add(event.digest);
    admitted.push(event);
  }
  return {
    admittedDigests: admitted.map((event) => event.digest).sort(),
    rejected: [...rejected.values()].sort((left, right) => left.eventId.localeCompare(right.eventId)),
    cardHeadDigests: Object.fromEntries(Object.entries(heads).map(([assetId, values]) => [assetId, uniqueSorted(values)])),
    xp: Object.fromEntries(Object.entries(xp).sort().map(([assetId, values]) => [assetId, Object.fromEntries(Object.entries(values).sort())])),
    historyIds: uniqueSorted(history), rewardIds: uniqueSorted(rewards),
    resources: Object.fromEntries(Object.entries(resources).sort()),
    injuryIds: Object.fromEntries(Object.entries(injuries).sort().map(([assetId, values]) => [assetId, uniqueSorted(values)])),
    retiredAssetIds: uniqueSorted(retired), ownership: Object.fromEntries(Object.entries(ownership).sort()),
  };
}
