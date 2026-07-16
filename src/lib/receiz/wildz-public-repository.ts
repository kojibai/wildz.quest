import type { JsonObject } from "@receiz/sdk";
import { WILDZ_PRODUCT } from "../wildz/product";
import {
  emptyWildzPublicState,
  restoreWildzPublicState,
  wildzPublicStateDigest,
  WILDZ_PUBLIC_STATE_SCHEMA,
  type WildzPublicState
} from "./wildz-public-state";

export const WILDZ_PUBLIC_NAMESPACE = "wildz:public:v1" as const;

export type WildzPublicHead = {
  revision: number;
  stateDigest: string;
  appendAnchorId: string | null;
  afterKaiUpulse: string | null;
};

export type WildzPublicLoad = {
  state: WildzPublicState;
  head: WildzPublicHead;
};

export type WildzPublicRepositoryAdapter = {
  restoreLatestPublicStore(input: { host: string; requiredSchema: string }): Promise<unknown>;
  publishPublicStore(input: Record<string, unknown>, options?: { idempotencyKey?: string }): Promise<unknown>;
};

/** This repository is a durable read projection, not atomic market authority. */
export interface WildzPublicProjectionRepository {
  load(): Promise<WildzPublicLoad>;
  publish(next: WildzPublicState, input: {
    expectedHead: WildzPublicHead;
    idempotencyKey: string;
    merchantReceizId: string;
  }): Promise<WildzPublicLoad>;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function nestedRecord(value: unknown, keys: readonly string[]): Record<string, unknown> | null {
  let current: unknown = value;
  for (const key of keys) {
    if (!isRecord(current)) return null;
    current = current[key];
  }
  return isRecord(current) ? current : null;
}

function restoredState(value: unknown) {
  const record = isRecord(value) ? value : {};
  const candidates = [
    record.state,
    record.storeStateRecord,
    nestedRecord(record, ["data", "storeStateRecord"]),
    nestedRecord(record, ["record", "data", "storeStateRecord"]),
    nestedRecord(record, ["record", "data"]),
    record.data
  ];
  for (const candidate of candidates) {
    const state = restoreWildzPublicState(candidate);
    if (state.schema === WILDZ_PUBLIC_STATE_SCHEMA
      && (state.revision > 0 || (isRecord(candidate) && candidate.schema === WILDZ_PUBLIC_STATE_SCHEMA))) return state;
  }
  return emptyWildzPublicState();
}

function stringOrNull(value: unknown) {
  return typeof value === "string" && value.trim() ? value : null;
}

function restoredRemoteHead(value: unknown) {
  const record = isRecord(value) ? value : {};
  const knownHead = isRecord(record.knownHead)
    ? record.knownHead
    : nestedRecord(record, ["data", "knownHead"])
      ?? nestedRecord(record, ["record", "knownHead"])
      ?? {};
  return {
    appendAnchorId: stringOrNull(knownHead.appendAnchorId ?? record.appendAnchorId),
    afterKaiUpulse: stringOrNull(knownHead.afterKaiUpulse ?? record.afterKaiUpulse)
  };
}

function sameHead(left: WildzPublicHead, right: WildzPublicHead) {
  return left.revision === right.revision
    && left.stateDigest === right.stateDigest
    && left.appendAnchorId === right.appendAnchorId
    && left.afterKaiUpulse === right.afterKaiUpulse;
}

function validIdempotencyKey(value: string) {
  if (!/^[a-zA-Z0-9@._:-]{1,200}$/.test(value)) throw new Error("wildz_public_idempotency_invalid");
  return value;
}

export function createReceizWildzPublicRepository(options: {
  adapter: WildzPublicRepositoryAdapter;
}): WildzPublicProjectionRepository {
  const load = async (): Promise<WildzPublicLoad> => {
    const recovered = await options.adapter.restoreLatestPublicStore({
      host: WILDZ_PRODUCT.domain,
      requiredSchema: WILDZ_PUBLIC_STATE_SCHEMA
    });
    const state = restoredState(recovered);
    const remoteHead = restoredRemoteHead(recovered);
    return {
      state,
      head: {
        revision: state.revision,
        stateDigest: wildzPublicStateDigest(state),
        ...remoteHead
      }
    };
  };

  return {
    load,
    async publish(next, input) {
      const current = await load();
      if (!sameHead(current.head, input.expectedHead)
        || next.revision !== current.state.revision + 1
        || !input.merchantReceizId.trim()) {
        throw new Error("wildz_public_projection_conflict");
      }
      const state = restoreWildzPublicState(next);
      if (state.revision !== next.revision) throw new Error("wildz_public_projection_invalid");
      const idempotencyKey = validIdempotencyKey(input.idempotencyKey);
      const result = await options.adapter.publishPublicStore({
        tenantHost: WILDZ_PRODUCT.domain,
        merchantReceizId: input.merchantReceizId,
        title: "Wildz verified public projection",
        sourceUrl: WILDZ_PRODUCT.origin,
        namespace: WILDZ_PUBLIC_NAMESPACE,
        projectionState: "published",
        schema: WILDZ_PUBLIC_STATE_SCHEMA,
        platform: WILDZ_PRODUCT.name,
        state: state as unknown as JsonObject,
        idempotencyKey
      }, { idempotencyKey });
      if (!isRecord(result) || result.ok === false) throw new Error("wildz_public_projection_publish_failed");
      const published = await load();
      if (published.state.revision !== state.revision
        || published.head.stateDigest !== wildzPublicStateDigest(state)) {
        throw new Error("wildz_public_projection_publish_unconfirmed");
      }
      return published;
    }
  };
}
