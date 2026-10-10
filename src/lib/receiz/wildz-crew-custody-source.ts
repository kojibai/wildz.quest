import { canOperateWildzCrewCard, mergeWildzCrewCustody, readWildzArtifactCrewCustody, readWildzNativeBearerCrewCustody, wildzCrewCustodySources, type WildzArtifactCodec, type WildzCrewCustody, type WildzCrewCustodySource } from "./wildz-artifact-codec";
import type { WildzContinuityDatabase } from "../storage/wildz-indexed-db";
import type { PortableCardAsset } from "../../features/play/portable-card";
import { sameWildzPlayerCoordinate } from "./wildz-player-coordinate";
import type { WildzArtifactHistoryEntry } from "./wildz-artifact-history";

/** Persisted coordinates are lookup hints only; bootstrap must reopen exact bytes. */
export function wildzCrewCustodySourceKey(keyId: string, actorId: string) {
  return JSON.stringify(["wildz:crew-custody-sources:v1", keyId, actorId]);
}
export function normalizeWildzCrewCustodySources(value: unknown): WildzCrewCustodySource[] {
  if (!Array.isArray(value) || value.length > 256) return [];
  return value.flatMap(row => row && typeof row === "object" && /^[a-f0-9]{64}$/.test(row.artifactSha256)
    && Array.isArray(row.assetIds) && row.assetIds.length <= 1000 && row.assetIds.every((id: unknown) => typeof id === "string")
    ? [{ artifactSha256: row.artifactSha256, assetIds: row.assetIds }] : []);
}
export async function reopenWildzCrewCustody(input: {
  owner: string; keyId?:string; cards: readonly PortableCardAsset[]; sources: unknown;
  history: { read(sha: string): Promise<Pick<WildzArtifactHistoryEntry, "artifactBytes" | "mimeType" | "filename"> | null> };
  codec: WildzArtifactCodec;
  readIdentitySeal?: () => Promise<WildzCrewCustody | null>;
  database?: WildzContinuityDatabase;
}): Promise<WildzCrewCustody | null> {
  const foreign = new Set(input.cards.filter(card => !sameWildzPlayerCoordinate(card.manifest.ownerReceizId, input.owner)).map(card => card.id));
  if (!foreign.size) return null;
  const tokens: WildzCrewCustody[] = [];
  const seen = new Set<string>();
  for (const ref of normalizeWildzCrewCustodySources(input.sources)) {
    if (seen.has(ref.artifactSha256) || !ref.assetIds.some(id => foreign.has(id))) continue;
    seen.add(ref.artifactSha256);
    try {
      const database = input.database ?? (await import("./wildz-active-identity")).defaultContinuityDatabase;
      const nativeGift = input.keyId ? await readWildzNativeBearerCrewCustody(database, ref.artifactSha256,{keyId:input.keyId,actorId:input.owner}).catch(() => null) : null;
      if (nativeGift) {
        if (sameWildzPlayerCoordinate(nativeGift.ownerHandle, input.owner)) tokens.push(nativeGift.crewCustody);
        continue;
      }
      const source = await input.history.read(ref.artifactSha256);
      if (!source) continue;
      const inspected = await input.codec.inspect({ bytes: source.artifactBytes, mimeType: source.mimeType, name: source.filename });
      const token = readWildzArtifactCrewCustody(inspected);
      if (token && sameWildzPlayerCoordinate(token.owner, input.owner)
        && wildzCrewCustodySources(token).every(row => row.artifactSha256 === ref.artifactSha256)) tokens.push(token);
    } catch { /* Foreign custody stays unavailable; original creatures work offline. */ }
  }
  const sourceCustody = mergeWildzCrewCustody(input.owner, tokens, input.cards);
  // Inspect the potentially large embedded Vault only when an exact admitted
  // source has not already established custody of every foreign crew card.
  if (!input.readIdentitySeal || input.cards.every(card => canOperateWildzCrewCard(card, input.owner, sourceCustody))) {
    return sourceCustody;
  }
  const sealCustody = await input.readIdentitySeal().catch(() => null);
  return mergeWildzCrewCustody(input.owner, [sourceCustody, sealCustody], input.cards);
}
