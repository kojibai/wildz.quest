import { createHash } from "node:crypto";
import type { JsonObject } from "@receiz/sdk";
import { canonicalPortableCardJson } from "../../features/play/portable-card";
import type { WildzMarketEvent } from "../../features/market/wildz-market";
import {
  advanceWildzMarketState,
  emptyWildzMarketState,
  restoreWildzMarketState,
  type WildzMarketState
} from "./wildz-market-state";

export const WILDZ_MARKET_NAMESPACE = "wildz:market:v1" as const;
const WILDZ_MARKET_TENANT = "wildz.quest" as const;
const WILDZ_MARKET_CREATOR = "wildz" as const;
const WILDZ_MARKET_PROJECTION_SCHEMA = "receiz.wildz_market.public_projection.v1" as const;

export type WildzMarketAdmissionProof = {
  schema: "receiz.wildz_market_admission.v1";
  admittedRevision: number;
  previousAppendAnchorId: string | null;
  appendAnchorId: string | null;
  proofBundle: JsonObject;
};

export type WildzMarketLoadResult =
  | { status: "ready"; state: WildzMarketState; admissionProof: WildzMarketAdmissionProof }
  | { status: "market_capability_unavailable" };

export type WildzMarketAdmission =
  | { status: "admitted" | "replayed"; state: WildzMarketState; admissionProof: WildzMarketAdmissionProof }
  | { status: "market_revision_conflict"; currentRevision: number; currentAppendAnchorId: string | null }
  | { status: "market_capability_unavailable" };

export interface WildzMarketRepository {
  load(): Promise<WildzMarketLoadResult>;
  compareAndAppend(input: {
    current: WildzMarketState;
    expectedRevision: number;
    expectedAppendAnchorId: string | null;
    idempotencyKey: string;
    occurredAt: string;
    event: WildzMarketEvent;
  }): Promise<WildzMarketAdmission>;
}

export interface WildzMarketConditionalAppendRail {
  readLatest(input: { namespace: typeof WILDZ_MARKET_NAMESPACE }): Promise<unknown>;
  compareAndAppend(input: {
    schema: "receiz.wildz_market_compare_append.v1";
    namespace: typeof WILDZ_MARKET_NAMESPACE;
    expectedRevision: number;
    expectedAppendAnchorId: string | null;
    idempotencyKey: string;
    occurredAt: string;
    event: WildzMarketEvent;
    nextState: WildzMarketState;
  }): Promise<unknown>;
  verifyAdmissionProof(input:
    | { kind: "load"; proof: WildzMarketAdmissionProof; state: WildzMarketState }
    | {
      kind: "append";
      proof: WildzMarketAdmissionProof;
      expectedRevision: number;
      expectedAppendAnchorId: string | null;
      event: WildzMarketEvent;
      state: WildzMarketState;
    }
  ): Promise<boolean>;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function stringOrNull(value: unknown): value is string | null {
  return value === null || (typeof value === "string" && value.length > 0 && value.length <= 512 && value.trim() === value);
}

function parseAdmissionProof(value: unknown): WildzMarketAdmissionProof | null {
  if (!isRecord(value)
    || value.schema !== "receiz.wildz_market_admission.v1"
    || !Number.isInteger(value.admittedRevision)
    || Number(value.admittedRevision) < 0
    || !stringOrNull(value.previousAppendAnchorId)
    || !stringOrNull(value.appendAnchorId)
    || !isRecord(value.proofBundle)
    || Object.keys(value.proofBundle).length === 0) return null;
  return {
    schema: "receiz.wildz_market_admission.v1",
    admittedRevision: Number(value.admittedRevision),
    previousAppendAnchorId: value.previousAppendAnchorId,
    appendAnchorId: value.appendAnchorId,
    proofBundle: value.proofBundle
  };
}

function parseRemoteSnapshot(value: unknown) {
  if (!isRecord(value) || value.ok !== true) return null;
  const state = restoreWildzMarketState(value.state);
  const admissionProof = parseAdmissionProof(value.admissionProof);
  if (!state
    || !admissionProof
    || state.revision !== admissionProof.admittedRevision
    || state.appendAnchorId !== admissionProof.appendAnchorId) return null;
  return { state, admissionProof };
}

function candidateRail(value: unknown) {
  if (!isRecord(value)) return null;
  if (isRecord(value.wildzMarket)) return value.wildzMarket;
  return isRecord(value.client) && isRecord(value.client.wildzMarket) ? value.client.wildzMarket : null;
}

function publicStoreRail(value: unknown): WildzMarketConditionalAppendRail | null {
  if (!isRecord(value)
    || typeof value.restoreLatestPublicStore !== "function"
    || typeof value.publishPublicStore !== "function") return null;
  const restore = value.restoreLatestPublicStore.bind(value) as (input: Record<string, unknown>) => Promise<unknown>;
  const publish = value.publishPublicStore.bind(value) as (input: Record<string, unknown>, options?: Record<string, unknown>) => Promise<unknown>;
  const admittedProofs = new WeakSet<object>();
  const genesis = () => ({
    ok: true,
    state: emptyWildzMarketState(),
    admissionProof: { schema: "receiz.wildz_market_admission.v1", admittedRevision: 0, previousAppendAnchorId: null, appendAnchorId: null, proofBundle: { schema: "receiz.wildz_market.genesis.v1", authority: "deterministic-source" } }
  });
  return {
    async readLatest() {
      const resolved = await restore({ tenantHost: WILDZ_MARKET_TENANT, requiredSchema: WILDZ_MARKET_PROJECTION_SCHEMA });
      if (!isRecord(resolved) || resolved.status === "not_found" || resolved.state === null) {
        const result = genesis(); admittedProofs.add(result.admissionProof.proofBundle); return result;
      }
      const state = restoreWildzMarketState(resolved.state);
      if (!state) throw new Error("wildz_market_projection_invalid");
      const result = {
        ok: true,
        state,
        admissionProof: {
          schema: "receiz.wildz_market_admission.v1",
          admittedRevision: state.revision,
          previousAppendAnchorId: state.revision === 0 ? null : String((resolved as Record<string, unknown>).previousAppendAnchorId ?? state.appendAnchorId),
          appendAnchorId: state.appendAnchorId,
          proofBundle: isRecord((resolved as Record<string, unknown>).proofBundle)
            ? (resolved as Record<string, unknown>).proofBundle
            : { schema: "receiz.public_store.verified_projection.v1", projectionId: String((resolved as Record<string, unknown>).id ?? "restored") }
        }
      };
      admittedProofs.add(result.admissionProof.proofBundle as object); return result;
    },
    async compareAndAppend(input) {
      const anchor = `ps:${createHash("sha256").update(WILDZ_MARKET_NAMESPACE).update("\0").update(input.idempotencyKey).update("\0").update(canonicalPortableCardJson(input.nextState)).digest("hex")}`;
      const state = { ...input.nextState, appendAnchorId: anchor };
      const response = await publish({
        tenantHost: WILDZ_MARKET_TENANT,
        merchantReceizId: WILDZ_MARKET_CREATOR,
        namespace: WILDZ_MARKET_NAMESPACE,
        schema: WILDZ_MARKET_PROJECTION_SCHEMA,
        projectionState: "verified",
        title: "Wildz Player Market",
        state,
        idempotencyKey: input.idempotencyKey
      }, { idempotencyKey: input.idempotencyKey });
      if (!isRecord(response) || response.ok === false) throw new Error("wildz_market_projection_publish_failed");
      const result = {
        ok: true,
        status: "admitted",
        state,
        admissionProof: {
          schema: "receiz.wildz_market_admission.v1",
          admittedRevision: state.revision,
          previousAppendAnchorId: input.expectedAppendAnchorId,
          appendAnchorId: anchor,
          proofBundle: isRecord(response.appendProof) ? response.appendProof : { schema: "receiz.public_store.append.v1", appendAnchorId: anchor }
        }
      };
      admittedProofs.add(result.admissionProof.proofBundle); return result;
    },
    async verifyAdmissionProof(input) {
      return typeof input.proof.proofBundle === "object"
        && input.proof.proofBundle !== null
        && admittedProofs.has(input.proof.proofBundle as object);
    }
  };
}

export function resolveWildzMarketConditionalAppendRail(value: unknown): WildzMarketConditionalAppendRail | null {
  const candidate = candidateRail(value);
  if (!candidate) return publicStoreRail(value);
  if (typeof candidate.readLatest !== "function"
    || typeof candidate.compareAndAppend !== "function"
    || typeof candidate.verifyAdmissionProof !== "function") return null;
  return {
    readLatest: candidate.readLatest.bind(candidate) as WildzMarketConditionalAppendRail["readLatest"],
    compareAndAppend: candidate.compareAndAppend.bind(candidate) as WildzMarketConditionalAppendRail["compareAndAppend"],
    verifyAdmissionProof: candidate.verifyAdmissionProof.bind(candidate) as WildzMarketConditionalAppendRail["verifyAdmissionProof"]
  };
}

export function createReceizWildzMarketRepository(options: {
  rail: WildzMarketConditionalAppendRail | null;
}): WildzMarketRepository {
  const unavailable = { status: "market_capability_unavailable" as const };

  return {
    async load() {
      if (!options.rail) return unavailable;
      try {
        const snapshot = parseRemoteSnapshot(await options.rail.readLatest({ namespace: WILDZ_MARKET_NAMESPACE }));
        if (!snapshot) return unavailable;
        const verified = await options.rail.verifyAdmissionProof({
          kind: "load",
          proof: snapshot.admissionProof,
          state: snapshot.state
        });
        return verified ? { status: "ready", ...snapshot } : unavailable;
      } catch {
        return unavailable;
      }
    },

    async compareAndAppend(input) {
      if (!options.rail) return unavailable;
      if (input.current.revision !== input.expectedRevision
        || input.current.appendAnchorId !== input.expectedAppendAnchorId) {
        return {
          status: "market_revision_conflict",
          currentRevision: input.current.revision,
          currentAppendAnchorId: input.current.appendAnchorId
        };
      }
      const nextState = advanceWildzMarketState(input.current, input.event, { occurredAt: input.occurredAt });
      let response: unknown;
      try {
        response = await options.rail.compareAndAppend({
          schema: "receiz.wildz_market_compare_append.v1",
          namespace: WILDZ_MARKET_NAMESPACE,
          expectedRevision: input.expectedRevision,
          expectedAppendAnchorId: input.expectedAppendAnchorId,
          idempotencyKey: input.idempotencyKey,
          occurredAt: input.occurredAt,
          event: input.event,
          nextState
        });
      } catch {
        return unavailable;
      }

      if (isRecord(response) && response.status === "conflict") {
        const competing = parseRemoteSnapshot(response);
        if (!competing) return unavailable;
        try {
          const verified = await options.rail.verifyAdmissionProof({
            kind: "load",
            proof: competing.admissionProof,
            state: competing.state
          });
          return verified ? {
            status: "market_revision_conflict",
            currentRevision: competing.state.revision,
            currentAppendAnchorId: competing.state.appendAnchorId
          } : unavailable;
        } catch {
          return unavailable;
        }
      }

      const admitted = parseRemoteSnapshot(response);
      if (!admitted
        || !isRecord(response)
        || (response.status !== "admitted" && response.status !== "replayed")
        || admitted.admissionProof.admittedRevision !== input.expectedRevision + 1
        || admitted.admissionProof.previousAppendAnchorId !== input.expectedAppendAnchorId
        || typeof admitted.admissionProof.appendAnchorId !== "string"
        || admitted.admissionProof.appendAnchorId.length === 0) return unavailable;
      const expectedRemoteState = { ...nextState, appendAnchorId: admitted.admissionProof.appendAnchorId };
      if (canonicalPortableCardJson(admitted.state) !== canonicalPortableCardJson(expectedRemoteState)) return unavailable;
      try {
        const verified = await options.rail.verifyAdmissionProof({
          kind: "append",
          proof: admitted.admissionProof,
          expectedRevision: input.expectedRevision,
          expectedAppendAnchorId: input.expectedAppendAnchorId,
          event: input.event,
          state: admitted.state
        });
        return verified ? {
          status: response.status,
          state: admitted.state,
          admissionProof: admitted.admissionProof
        } : unavailable;
      } catch {
        return unavailable;
      }
    }
  };
}
