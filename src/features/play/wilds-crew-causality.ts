import { digestReceizCanonicalV122 } from "@receiz/sdk";

/** Local observations are scheduling evidence, not admitted world effects. Persist these
 * records append-only; use compare-and-swap on workerHead before accepting a proposal. */
export type WildsCrewCausalEvent = Readonly<{
  schema: "wildz.crew.causal-event.v1";
  eventId: string;
  workerId: string;
  jobId: string;
  commandDigest: string;
  observedKaiUPulse: number;
  causalKaiUPulse: number;
  sequence: number;
  previousWorkerEventId: string | null;
  parents: readonly string[];
  phase: "proposed" | "pending" | "admitted" | "rejected";
  admittedWorldEventIds: readonly string[];
}>;

type EventBody = Omit<WildsCrewCausalEvent, "eventId">;
const id = (value: string) => typeof value === "string" && value.length > 0 && value.length <= 512;
const pulse = (value: number) => Number.isSafeInteger(value) && value >= 0;

/** Parents must come from the verified local journal; effect IDs must come from the
 * admitted transaction, never from creature narration. Unrelated workers stay concurrent.
 * This does no polling, rendering, networking or clock observation of its own. */
export async function createWildsCrewCausalEvent(input: Readonly<{
  workerId: string;
  jobId: string;
  commandDigest: string;
  observedKaiUPulse: number;
  previous: WildsCrewCausalEvent | null;
  dependencies: readonly WildsCrewCausalEvent[];
  phase: WildsCrewCausalEvent["phase"];
  admittedWorldEventIds?: readonly string[];
}>): Promise<WildsCrewCausalEvent> {
  // Snapshot caller-owned arrays before asynchronous digest verification.
  const request = structuredClone(input);
  if (![request.workerId, request.jobId, request.commandDigest].every(id)
    || !pulse(request.observedKaiUPulse) || request.dependencies.length > 64
    || !["proposed", "pending", "admitted", "rejected"].includes(request.phase)) throw new Error("crew_causal_input_invalid");
  const previous = request.previous;
  if (previous && !await verifyWildsCrewCausalEvent(previous)) throw new Error("crew_causal_parent_invalid");
  if (previous && previous.workerId !== request.workerId) throw new Error("crew_causal_worker_mismatch");
  const parents = [...request.dependencies];
  if (previous && !parents.some(parent => parent.eventId === previous.eventId)) parents.push(previous);
  if (new Set(parents.map(parent => parent.eventId)).size !== parents.length) throw new Error("crew_causal_duplicate_parent");
  for (const parent of parents) {
    if (!await verifyWildsCrewCausalEvent(parent)) throw new Error("crew_causal_parent_invalid");
  }
  // Work may depend on completed effects only. Pending work cannot fund another task.
  if (request.dependencies.some(parent => parent.phase !== "admitted")) throw new Error("crew_causal_dependency_unadmitted");
  const continuing = previous?.jobId === request.jobId && previous.commandDigest === request.commandDigest;
  if (request.phase === "proposed") {
    if (continuing) throw new Error("crew_causal_command_replayed");
    if (previous && (previous.phase === "proposed" || previous.phase === "pending")) throw new Error("crew_causal_worker_busy");
  } else if (!continuing || !previous || !["proposed", "pending"].includes(previous.phase)) {
    throw new Error("crew_causal_transition_invalid");
  }
  const effects = [...(request.admittedWorldEventIds ?? [])];
  if (effects.length > 256 || effects.some(effect => !id(effect)) || new Set(effects).size !== effects.length
    || (request.phase === "admitted" ? effects.length === 0 : effects.length !== 0)) throw new Error("crew_causal_effects_invalid");
  const body: EventBody = {
    schema: "wildz.crew.causal-event.v1", workerId: request.workerId, jobId: request.jobId,
    commandDigest: request.commandDigest, observedKaiUPulse: request.observedKaiUPulse,
    // Preserve the actual clock observation; do not invent a later physical time to order ties.
    causalKaiUPulse: Math.max(request.observedKaiUPulse, ...parents.map(parent => parent.causalKaiUPulse)),
    sequence: Math.max(0, ...parents.map(parent => parent.sequence)) + 1,
    previousWorkerEventId: previous?.eventId ?? null,
    parents: Object.freeze(parents.map(parent => parent.eventId).sort()), phase: request.phase,
    admittedWorldEventIds: Object.freeze(effects)
  };
  if (!Number.isSafeInteger(body.sequence)) throw new Error("crew_causal_sequence_overflow");
  return Object.freeze({ ...body, eventId: await digestReceizCanonicalV122(body) });
}

/** Integrity only. This does not establish current ownership, mandate or world admission. */
export async function verifyWildsCrewCausalEvent(event: WildsCrewCausalEvent): Promise<boolean> {
  try {
    const { eventId, ...body } = event;
    return body.schema === "wildz.crew.causal-event.v1" && pulse(body.observedKaiUPulse)
      && pulse(body.causalKaiUPulse) && body.causalKaiUPulse >= body.observedKaiUPulse
      && Number.isSafeInteger(body.sequence) && body.sequence > 0
      && [body.workerId, body.jobId, body.commandDigest].every(id)
      && ["proposed", "pending", "admitted", "rejected"].includes(body.phase)
      && Array.isArray(body.parents) && body.parents.length <= 65 && body.parents.every(id)
      && new Set(body.parents).size === body.parents.length
      && (body.previousWorkerEventId === null || body.parents.includes(body.previousWorkerEventId))
      && Array.isArray(body.admittedWorldEventIds) && body.admittedWorldEventIds.length <= 256
      && body.admittedWorldEventIds.every(id) && new Set(body.admittedWorldEventIds).size === body.admittedWorldEventIds.length
      && (body.phase === "admitted" ? body.admittedWorldEventIds.length > 0 : body.admittedWorldEventIds.length === 0)
      && await digestReceizCanonicalV122(body) === eventId;
  } catch { return false; }
}
