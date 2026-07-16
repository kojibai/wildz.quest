import type { JsonObject } from "@receiz/sdk";
import type { WildsWorldEvent } from "../../features/play/wilds-world-event";
import { findWildsWorldRecord, type WildsWorldRecord } from "../../features/play/wilds-world-record";
import { canonicalPortableCardJson } from "../../features/play/portable-card";
import { platform } from "../platform";
import type { ReceizCommerceAdapter } from "./adapter";

export type WildsWorldRepositoryActor = {
  handle: string;
  practice: boolean;
  accessToken?: string;
};

export type WildsWorldPublication = {
  published: boolean;
  mode: "receiz_live" | "local_practice" | "receiz_recovery_pending";
  revision: number;
  conflict?: boolean;
  record?: WildsWorldRecord | null;
};

export type WildsWorldHead = { revision: number; lastEventId: string | null };

export interface WildsWorldRepository {
  recover(sourceUrl: string): Promise<WildsWorldRecord | null>;
  publish(input: {
    sourceUrl: string;
    actor: WildsWorldRepositoryActor;
    record: WildsWorldRecord;
    expectedHead: WildsWorldHead;
  }): Promise<WildsWorldPublication>;
  audit(input: {
    sourceUrl: string;
    actor: WildsWorldRepositoryActor;
    events: readonly WildsWorldEvent[];
  }): Promise<boolean>;
}

type WildsWorldRepositoryAdapter = Pick<
  ReceizCommerceAdapter,
  "readAppStateByUrl" | "publishPublicStore" | "auditAppend"
>;

type WildsWorldRepositoryAdapterFactory = (
  options?: { accessToken?: string }
) => WildsWorldRepositoryAdapter | Promise<WildsWorldRepositoryAdapter>;

const MAJOR_WORLD_EVENTS = new Set<WildsWorldEvent["kind"]>([
  "boss.emerged",
  "boss.defeated",
  "site.memorialized",
  "ecology.resolved",
  "ecology.historicized",
  "team.created",
  "league.scored"
]);

function head(record: WildsWorldRecord | null): WildsWorldHead {
  return record
    ? { revision: record.checkpoint.revision, lastEventId: record.checkpoint.lastEventId }
    : { revision: 0, lastEventId: null };
}

function sameHead(left: WildsWorldHead, right: WildsWorldHead) {
  return left.revision === right.revision && left.lastEventId === right.lastEventId;
}

function sameRecord(left: WildsWorldRecord, right: WildsWorldRecord) {
  return canonicalPortableCardJson(left) === canonicalPortableCardJson(right);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function feedAccepted(value: unknown) {
  return isRecord(value)
    && value.ok === true
    && ((Number.isInteger(value.accepted) && Number(value.accepted) > 0)
      || (Array.isArray(value.records) && value.records.length > 0));
}

function returnedWorldRecord(value: unknown) {
  const direct = findWildsWorldRecord(value);
  if (direct || !isRecord(value) || !Array.isArray(value.records)) return direct;
  for (const record of value.records) {
    const found = findWildsWorldRecord(record);
    if (found) return found;
  }
  return null;
}

export function createReceizWildsWorldRepository(options: {
  adapterFactory?: WildsWorldRepositoryAdapterFactory;
} = {}): WildsWorldRepository {
  const adapterFactory = options.adapterFactory ?? (async (adapterOptions) => (
    await import("./adapter")
  ).createReceizCommerceAdapter(adapterOptions));

  return {
    async recover(sourceUrl) {
      const adapter = await adapterFactory();
      return findWildsWorldRecord(await adapter.readAppStateByUrl(sourceUrl));
    },

    async publish(input) {
      const revision = input.record.checkpoint.revision;
      if (input.actor.practice) return { published: false, mode: "local_practice", revision };
      const lastEventId = input.record.checkpoint.lastEventId ?? "genesis";
      let adapter: WildsWorldRepositoryAdapter | null = null;
      try {
        adapter = await adapterFactory(input.actor.accessToken ? { accessToken: input.actor.accessToken } : undefined);
        const recovered = findWildsWorldRecord(await adapter.readAppStateByUrl(input.sourceUrl));
        if (!sameHead(head(recovered), input.expectedHead)) {
          return { published: false, mode: "receiz_recovery_pending", revision, conflict: true, record: recovered };
        }
        const result = await adapter.publishPublicStore({
          tenantHost: new URL(input.sourceUrl).host,
          merchantReceizId: input.actor.handle,
          title: "Receiz Wilds canonical world",
          sourceUrl: input.sourceUrl,
          namespace: "wilds:global:v3",
          projectionState: "published",
          platform: platform.productName,
          state: input.record as unknown as JsonObject
        }, { idempotencyKey: `wilds:global:v3:${revision}:${lastEventId}` });
        if (!feedAccepted(result)) {
          const competing = findWildsWorldRecord(await adapter.readAppStateByUrl(input.sourceUrl));
          if (competing && !sameHead(head(competing), input.expectedHead)) {
            return { published: false, mode: "receiz_recovery_pending", revision, conflict: true, record: competing };
          }
          return { published: false, mode: "receiz_recovery_pending", revision };
        }
        // SDK v102 publicStore.publish is not a cross-process compare-and-append
        // rail. Serialize locally, compare the recovered head before writing,
        // and claim durability only after its supported feed acknowledgement
        // plus an exact returned/remote record check. A competing record is
        // returned for rehydration; later cross-instance overwrite remains a
        // known limitation of this public projection rail.
        const admitted = returnedWorldRecord(result)
          ?? findWildsWorldRecord(await adapter.readAppStateByUrl(input.sourceUrl));
        if (!admitted || !sameRecord(admitted, input.record)) {
          return {
            published: false,
            mode: "receiz_recovery_pending",
            revision,
            ...(admitted ? { conflict: true, record: admitted } : {})
          };
        }
        return { published: true, mode: "receiz_live", revision, conflict: false, record: admitted };
      } catch {
        if (adapter) {
          try {
            const competing = findWildsWorldRecord(await adapter.readAppStateByUrl(input.sourceUrl));
            if (competing && !sameHead(head(competing), input.expectedHead)) {
              return { published: false, mode: "receiz_recovery_pending", revision, conflict: true, record: competing };
            }
          } catch {
            // Recovery is retried before the next canonical mutation.
          }
        }
        return { published: false, mode: "receiz_recovery_pending", revision };
      }
    },

    async audit(input) {
      if (input.actor.practice) return true;
      const events = input.events.filter((event) => MAJOR_WORLD_EVENTS.has(event.kind));
      if (!events.length) return true;
      try {
        const client = await adapterFactory(input.actor.accessToken ? { accessToken: input.actor.accessToken } : undefined);
        for (const event of events) {
          await client.auditAppend({
            tenantHost: new URL(input.sourceUrl).host,
            action: `wilds.${event.kind}:${event.eventId}`,
            actorReceizId: input.actor.handle
          }, { idempotencyKey: event.eventId });
        }
        return true;
      } catch {
        return false;
      }
    }
  };
}
