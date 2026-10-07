import type { WildzPlayerStateRecord } from "../receiz/wildz-player-state-sync";

export type WildzPlayerStateReceipt = Pick<WildzPlayerStateRecord, "playerId" | "sourceDigest" | "revision">;
export type WildzPlayerStateResponseBody = { ok: true; record: WildzPlayerStateRecord | null } | { ok: true; receipt: WildzPlayerStateReceipt };

export function projectWildzPlayerStateResponse(record: WildzPlayerStateRecord | null, options: {
  compact?: boolean;
  incomingDigest?: string;
  ifNoneMatch?: string | null;
} = {}): { status: 200 | 304; etag?: string; body: WildzPlayerStateResponseBody | null } {
  const etag = record ? `"${record.sourceDigest}"` : undefined;
  if (etag && options.ifNoneMatch === etag) return { status: 304, etag, body: null };
  if (record && options.compact && options.incomingDigest === record.sourceDigest) {
    const { playerId, sourceDigest, revision } = record;
    return { status: 200, etag, body: { ok: true, receipt: { playerId, sourceDigest, revision } } };
  }
  return { status: 200, etag, body: { ok: true, record } };
}
