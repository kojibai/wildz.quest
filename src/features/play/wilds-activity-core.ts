import type { WildsLandmarkId } from "./wilds-landmarks";
import { canonicalPortableCardJson, sha256PortableBasis, verifiedPortableCardPin, type PortableCardAsset, type VerifiedPortableCardPin } from "./portable-card";

export type WildsActivityPhase = "lobby" | "ready" | "active" | "result" | "reward" | "exited";
export type WildsActivityResult = { digest: string; score: number; winnerActorId?: string };
export type WildsActivityReward = { id: string; kind: "achievement" | "cosmetic" | "lore" };
export type WildsActivityEvent = {
  id: string;
  actorId: string;
  kind: "admitted" | "started" | "resolved" | "rewarded" | "exited";
  mutationKey: string;
  revision: number;
};

export type WildsActivitySession = {
  id: string;
  landmarkId: WildsLandmarkId;
  actorIds: string[];
  createdAt: string;
  deterministicSeed: string;
  phase: WildsActivityPhase;
  revision: number;
  admissions: Record<string, VerifiedPortableCardPin>;
  result: WildsActivityResult | null;
  reward: WildsActivityReward | null;
  returnCoordinate: { x: number; z: number };
  events: WildsActivityEvent[];
};

function requireText(value: string, error: string) {
  const normalized = value.trim();
  if (!normalized || normalized.length > 96) throw new Error(error);
  return normalized;
}

function requireActor(session: WildsActivitySession, actorId: string) {
  if (!session.actorIds.includes(actorId)) throw new Error("wilds_activity_actor_invalid");
}

function seen(session: WildsActivitySession, mutationKey: string) {
  return session.events.some((event) => event.mutationKey === mutationKey);
}

function appendEvent(session: WildsActivitySession, input: Omit<WildsActivityEvent, "id" | "revision">): WildsActivitySession {
  const revision = session.revision + 1;
  const event = {
    ...input,
    id: sha256PortableBasis(canonicalPortableCardJson({ sessionId: session.id, revision, ...input })),
    revision
  };
  return { ...session, revision, events: [...session.events, event] };
}

export function createLandmarkSession(input: {
  id: string;
  landmarkId: WildsLandmarkId;
  actorIds: string[];
  createdAt: string;
  returnCoordinate: { x: number; z: number };
}): WildsActivitySession {
  const id = requireText(input.id, "wilds_activity_id_invalid");
  if (!Number.isFinite(Date.parse(input.createdAt))) throw new Error("wilds_activity_time_invalid");
  const actorIds = [...new Set(input.actorIds.map((actorId) => requireText(actorId, "wilds_activity_actor_invalid")))];
  if (!actorIds.length || actorIds.length > 8) throw new Error("wilds_activity_actor_invalid");
  if (![input.returnCoordinate.x, input.returnCoordinate.z].every(Number.isFinite)) throw new Error("wilds_activity_return_invalid");
  return {
    id,
    landmarkId: input.landmarkId,
    actorIds,
    createdAt: input.createdAt,
    deterministicSeed: sha256PortableBasis(canonicalPortableCardJson({ id, landmarkId: input.landmarkId, actorIds, createdAt: input.createdAt })),
    phase: "lobby",
    revision: 0,
    admissions: {},
    result: null,
    reward: null,
    returnCoordinate: { ...input.returnCoordinate },
    events: []
  };
}

export function admitActivityCard(session: WildsActivitySession, actorId: string, card: PortableCardAsset, mutationKey: string) {
  requireActor(session, actorId);
  const key = requireText(mutationKey, "wilds_activity_mutation_invalid");
  if (seen(session, key)) return session;
  if (session.phase !== "lobby" && session.phase !== "ready") throw new Error("wilds_activity_admission_closed");
  const pin = verifiedPortableCardPin(card);
  const existing = session.admissions[actorId];
  if (existing && existing.proofDigest !== pin.proofDigest) throw new Error("wilds_activity_proof_change_rejected");
  const admissions = { ...session.admissions, [actorId]: pin };
  const next = appendEvent(session, { actorId, kind: "admitted", mutationKey: key });
  return { ...next, admissions, phase: session.actorIds.every((id) => admissions[id]) ? "ready" as const : "lobby" as const };
}

export function advanceActivity(session: WildsActivitySession, actorId: string, mutationKey: string) {
  requireActor(session, actorId);
  const key = requireText(mutationKey, "wilds_activity_mutation_invalid");
  if (seen(session, key)) return session;
  if (session.phase !== "ready") throw new Error("wilds_activity_not_ready");
  const next = appendEvent(session, { actorId, kind: "started", mutationKey: key });
  return { ...next, phase: "active" as const };
}

export function resolveActivityResult(session: WildsActivitySession, result: WildsActivityResult, mutationKey: string) {
  const key = requireText(mutationKey, "wilds_activity_mutation_invalid");
  if (session.result) {
    if (seen(session, key) && canonicalPortableCardJson(session.result) === canonicalPortableCardJson(result)) return session;
    throw new Error("wilds_activity_result_locked");
  }
  if (session.phase !== "active" || !Number.isFinite(result.score) || !/^sha256:[a-f0-9]{64}$/.test(result.digest)) throw new Error("wilds_activity_result_invalid");
  if (result.winnerActorId && !session.actorIds.includes(result.winnerActorId)) throw new Error("wilds_activity_result_actor_invalid");
  const next = appendEvent(session, { actorId: result.winnerActorId ?? session.actorIds[0]!, kind: "resolved", mutationKey: key });
  return { ...next, phase: "result" as const, result: { ...result } };
}

export function grantActivityReward(session: WildsActivitySession, reward: WildsActivityReward, mutationKey: string) {
  const key = requireText(mutationKey, "wilds_activity_mutation_invalid");
  if (session.reward) {
    if (seen(session, key) && canonicalPortableCardJson(session.reward) === canonicalPortableCardJson(reward)) return session;
    throw new Error("wilds_activity_reward_locked");
  }
  if (session.phase !== "result") throw new Error("wilds_activity_reward_unavailable");
  const normalized = { ...reward, id: requireText(reward.id, "wilds_activity_reward_invalid") };
  const next = appendEvent(session, { actorId: session.result?.winnerActorId ?? session.actorIds[0]!, kind: "rewarded", mutationKey: key });
  return { ...next, phase: "reward" as const, reward: normalized };
}

export function exitActivity(session: WildsActivitySession, actorId: string, mutationKey: string) {
  requireActor(session, actorId);
  const key = requireText(mutationKey, "wilds_activity_mutation_invalid");
  if (seen(session, key) || session.phase === "exited") return session;
  const next = appendEvent(session, { actorId, kind: "exited", mutationKey: key });
  return { ...next, phase: "exited" as const };
}
