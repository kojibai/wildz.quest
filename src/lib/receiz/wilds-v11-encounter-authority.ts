import type { ReceizAdmissionStore, ReceizAdmissionUnitOfWork } from "@receiz/sdk";
import { canonicalPortableCardJson, sha256PortableBasis } from "@/features/play/portable-card";
import { generateWildsRegionV11 } from "@/features/play/wilds-region-generator-v11";
import { WILDS_RARITY_LAW_V11 } from "@/features/play/wilds-rarity-law-v11";
import { parseWildsWorldAddress, type WildsWorldAddress } from "@/features/play/wilds-world-address";
import { verifyEncounterResultV11, type WildsV11EncounterResult } from "@/features/play/wilds-encounter-proof-v11";
import { signWildsV11Encounter } from "./wilds-v11-encounter-signer";

const TRAVEL_SCHEMA = "wildz.travel-head.v11" as const;
const ENCOUNTER_SCHEMA = "wildz.encounter-head.v11" as const;
const ISSUE_RATE_SCHEMA = "wildz.encounter-issue-rate.v11" as const;
const REGION_MICRO = 24_000_000n;
const MAX_SPEED_MICRO_PER_MS = 12_000n;
const MAX_REPORTED_STEP_MS = 30_000;
const SITE_REACH_MICRO = 3_000_000n;
const ISSUE_WINDOW_MS = 60_000;
const MAX_NEW_ISSUES_PER_WINDOW = 12;
const START: WildsWorldAddress = { worldVersion: 11, regionX: "0", regionZ: "0", localX: 0, localZ: 0 };

type TravelHead = Readonly<{ schema: typeof TRAVEL_SCHEMA; actorId: string; address: WildsWorldAddress; observedAtMs: number }>;
type EncounterHead = Readonly<{ schema: typeof ENCOUNTER_SCHEMA; actorId: string; result: WildsV11EncounterResult }>;
type IssueRateHead = Readonly<{ schema: typeof ISSUE_RATE_SCHEMA; actorId: string;
  recent: readonly Readonly<{ siteKey: string; issuedAtMs: number }>[] }>;

function actorKey(actorId: string) {
  if (!/^[a-z0-9:._-]{3,180}$/i.test(actorId)) throw new Error("wilds_v11_actor_invalid");
  return `wildz11:travel:${sha256PortableBasis(actorId)}`;
}

function issueRateKey(actorId: string) {
  return `wildz11:issue-rate:${sha256PortableBasis(actorId)}`;
}

function exactDeltaMicro(left: WildsWorldAddress, right: WildsWorldAddress) {
  return {
    x: (BigInt(left.regionX) - BigInt(right.regionX)) * REGION_MICRO + BigInt(left.localX - right.localX),
    z: (BigInt(left.regionZ) - BigInt(right.regionZ)) * REGION_MICRO + BigInt(left.localZ - right.localZ)
  };
}

function withinReach(left: WildsWorldAddress, right: WildsWorldAddress, reachMicro: bigint) {
  const { x, z } = exactDeltaMicro(left, right);
  return x * x + z * z <= reachMicro * reachMicro;
}

function travelHead(value: unknown, actorId: string): TravelHead | null {
  if (!value || typeof value !== "object") return null;
  const head = value as Partial<TravelHead>;
  if (head.schema !== TRAVEL_SCHEMA || head.actorId !== actorId || !Number.isSafeInteger(head.observedAtMs)) return null;
  try { return { schema: TRAVEL_SCHEMA, actorId, address: parseWildsWorldAddress(head.address), observedAtMs: head.observedAtMs! }; }
  catch { return null; }
}

function admissionUnit(aggregateId: string, revision: number, previousDigest: string | null, command: object, nextState: object): ReceizAdmissionUnitOfWork {
  const commandDigest = sha256PortableBasis(canonicalPortableCardJson(command));
  const digest = sha256PortableBasis(canonicalPortableCardJson({ aggregateId, revision: revision + 1, previousDigest, nextState }));
  const receipt = { schema: "wildz.admission-receipt.v11", aggregateId, commandDigest, digest };
  return {
    schema: "receiz.admission.unit-of-work.v1",
    aggregateId,
    commandDigest,
    idempotencyKey: `${aggregateId}:${commandDigest}`,
    expectedRevision: revision,
    expectedHeadDigest: previousDigest,
    acceptedCommand: command,
    events: [{ schema: "wildz.admission-event.v11", commandDigest, digest }],
    nextHead: { revision: revision + 1, digest, state: nextState },
    resourceEffects: {},
    receipt,
    outboxIntents: [],
    auditReference: { aggregateId, digest }
  } as ReceizAdmissionUnitOfWork;
}

/** A bounded actor-level reservation serializes distinct-site issuance across server instances. */
async function reserveWildsV11Issue(store: ReceizAdmissionStore, actorId: string, siteKey: string, issuedAtMs: number) {
  if (!Number.isSafeInteger(issuedAtMs) || issuedAtMs < 0) throw new Error("wilds_v11_issue_time_invalid");
  const key = issueRateKey(actorId);
  for (let attempt = 0; attempt < 8; attempt += 1) {
    const prior = await store.readAggregate(key);
    const head = prior?.state as Partial<IssueRateHead> | undefined;
    if (prior && (head?.schema !== ISSUE_RATE_SCHEMA || head.actorId !== actorId || !Array.isArray(head.recent)
      || head.recent.length > MAX_NEW_ISSUES_PER_WINDOW || head.recent.some(entry => !entry || typeof entry.siteKey !== "string"
        || !Number.isSafeInteger(entry.issuedAtMs) || entry.issuedAtMs < 0))) {
      throw new Error("wilds_v11_issue_rate_head_invalid");
    }
    const recent = (head?.recent ?? []).filter(entry => {
      if (entry.issuedAtMs > issuedAtMs) throw new Error("wilds_v11_issue_time_regressed");
      return issuedAtMs - entry.issuedAtMs < ISSUE_WINDOW_MS;
    });
    if (recent.some(entry => entry.siteKey === siteKey)) return;
    if (recent.length >= MAX_NEW_ISSUES_PER_WINDOW) throw new Error("wilds_v11_issue_rate_limited");
    const nextState: IssueRateHead = { schema: ISSUE_RATE_SCHEMA, actorId,
      recent: [...recent, { siteKey, issuedAtMs }] };
    const outcome = await store.commit(admissionUnit(key, prior?.revision ?? 0, prior?.headDigest ?? null,
      { type: "wildz.encounter-issue-reserve.v11", actorId, siteKey, issuedAtMs }, nextState));
    if (outcome.status === "committed" || outcome.status === "idempotent") return;
    if (outcome.status !== "conflict") throw new Error(`wilds_v11_issue_rate_${outcome.status}`);
  }
  throw new Error("wilds_v11_issue_rate_conflict");
}

/** Server-only movement admission. This never reads the ephemeral presence feed. */
export async function admitWildsV11Travel(store: ReceizAdmissionStore, actorId: string, addressValue: WildsWorldAddress, observedAtMs = Date.now()) {
  const address = parseWildsWorldAddress(addressValue);
  const key = actorKey(actorId);
  if (!Number.isSafeInteger(observedAtMs) || observedAtMs < 0) throw new Error("wilds_v11_travel_time_invalid");
  const prior = await store.readAggregate(key);
  const previous = prior ? travelHead(prior.state, actorId) : null;
  if (prior && !previous) throw new Error("wilds_v11_travel_head_invalid");
  if (!previous && !withinReach(address, START, 0n)) throw new Error("wilds_v11_origin_required");
  if (previous) {
    const elapsed = observedAtMs - previous.observedAtMs;
    if (elapsed < 0) throw new Error("wilds_v11_travel_time_regressed");
    // Idle wall time does not attest continuous movement. One report may only
    // claim a bounded step; farther travel needs a sequence of admissions.
    if (!withinReach(address, previous.address, BigInt(Math.min(elapsed, MAX_REPORTED_STEP_MS)) * MAX_SPEED_MICRO_PER_MS)) {
      throw new Error("wilds_v11_travel_speed_exceeded");
    }
  }
  const nextState: TravelHead = { schema: TRAVEL_SCHEMA, actorId, address, observedAtMs };
  const outcome = await store.commit(admissionUnit(key, prior?.revision ?? 0, prior?.headDigest ?? null,
    { type: "wildz.travel.v11", actorId, address, observedAtMs }, nextState));
  if (outcome.status !== "committed" && outcome.status !== "idempotent") throw new Error(`wilds_v11_travel_${outcome.status}`);
  return nextState;
}

function siteSlotAddress(site: WildsWorldAddress, slot: number): WildsWorldAddress {
  if (!Number.isInteger(slot) || slot < 0 || slot > 5) throw new Error("wilds_v11_site_slot_invalid");
  const generated = generateWildsRegionV11(site.regionX, site.regionZ).encounterSites[slot]!;
  return { worldVersion: 11, regionX: site.regionX, regionZ: site.regionZ, localX: generated.localX, localZ: generated.localZ };
}

/** One sparse actor/site aggregate survives retries, process changes, and release-key rotation. */
export async function issueWildsV11Encounter(input: {
  store: ReceizAdmissionStore;
  actorId: string;
  site: WildsWorldAddress;
  slot: number;
  keyId: string;
  privateKeyPem: string;
  pinnedKeys: Readonly<Record<string, string>>;
  issuedAtMs?: number;
}) {
  const site = parseWildsWorldAddress(input.site);
  const target = siteSlotAddress(site, input.slot);
  if (!withinReach(site, target, 0n)) throw new Error("wilds_v11_site_not_generated");
  const travel = await input.store.readAggregate(actorKey(input.actorId));
  const admitted = travelHead(travel?.state, input.actorId);
  if (!admitted || !withinReach(admitted.address, site, SITE_REACH_MICRO)) throw new Error("wilds_v11_site_not_reached");
  const key = `wildz11:encounter:${sha256PortableBasis(canonicalPortableCardJson([input.actorId, site, input.slot]))}`;
  const existing = await input.store.readAggregate(key);
  if (existing) {
    const head = existing.state as Partial<EncounterHead>;
    if (head.schema !== ENCOUNTER_SCHEMA || head.actorId !== input.actorId || !head.result
      || !await verifyEncounterResultV11(head.result, input.pinnedKeys)) throw new Error("wilds_v11_encounter_head_invalid");
    return head.result;
  }
  await reserveWildsV11Issue(input.store, input.actorId,
    sha256PortableBasis(canonicalPortableCardJson([site, input.slot])), input.issuedAtMs ?? Date.now());
  const result = signWildsV11Encounter({ schema: "wildz.encounter-input.v11", keyId: input.keyId,
    law: WILDS_RARITY_LAW_V11, actorId: input.actorId, site, slot: input.slot }, input.privateKeyPem);
  if (!await verifyEncounterResultV11(result, input.pinnedKeys)) throw new Error("wilds_v11_signing_key_unpinned");
  const outcome = await input.store.commit(admissionUnit(key, 0, null,
    { type: "wildz.encounter.v11", actorId: input.actorId, site, slot: input.slot },
    { schema: ENCOUNTER_SCHEMA, actorId: input.actorId, result } satisfies EncounterHead));
  if (outcome.status === "committed" || outcome.status === "idempotent") return result;
  if (outcome.status === "conflict") {
    const winner = await input.store.readAggregate(key);
    const head = winner?.state as Partial<EncounterHead> | undefined;
    if (head?.schema === ENCOUNTER_SCHEMA && head.actorId === input.actorId && head.result
      && await verifyEncounterResultV11(head.result, input.pinnedKeys)) return head.result;
  }
  throw new Error(`wilds_v11_encounter_${outcome.status}`);
}
