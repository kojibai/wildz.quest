import { receizBase64UrlDecode, verifyReceizArtifact } from "@receiz/sdk";
import { portableCardPngBlobForIdentityOwnership } from "../../features/play/card-export";
import { type PortableCardAsset, verifyAnyWildsCard } from "../../features/play/portable-card";
import { cardArtifactFingerprint } from "../../features/play/prepared-card-artifact";
import { type WildzAdmittedArtifact, sha256WildzArtifactBytes } from "./wildz-artifact-custody";
import type { createWildzProofSourceRepository } from "./wildz-proof-source-repository";
import { openWildzArtifactSameOrigin, type WildzVerifierFetch } from "./wildz-same-origin-verifier";
import { openWildzSealedDocument } from "./wildz-sealed-document";
import { sameWildzPlayerCoordinate } from "./wildz-player-coordinate";
import { validateWildsRoamingHandoffCard } from "./wilds-roaming-handoff";

type Sources = Pick<ReturnType<typeof createWildzProofSourceRepository>, "read" | "locateAsset" | "retain">;

/** Browser-only source custody composition. Existing native sources are selected
 * by verified ancestry, never by index order or mutable card fingerprints. */
export function createWildsRoamingOwnerFilePreparer(dependencies: Readonly<{
  sources: Sources;
  fetch?: WildzVerifierFetch;
  renderCard?: typeof portableCardPngBlobForIdentityOwnership;
}>) {
  const active = new Map<string, { fingerprint: string; promise: Promise<WildzAdmittedArtifact> }>();
  const fetchImpl = dependencies.fetch ?? fetch;
  async function open(bytes: Uint8Array, filename: string, mimeType: string) {
    const admitted = await openWildzArtifactSameOrigin({ bytes, name: filename, mimeType }, fetchImpl);
    if (admitted.artifactSha256 !== await sha256WildzArtifactBytes(bytes)) throw new Error("wilds_roaming_source_digest_mismatch");
    return admitted;
  }
  return function prepare(assetInput: PortableCardAsset, ownerHandle: string): Promise<WildzAdmittedArtifact> {
    const asset = structuredClone(assetInput);
    const fingerprint = cardArtifactFingerprint(asset);
    const key = JSON.stringify([ownerHandle, asset.id]);
    const prior = active.get(key);
    if (prior) return prior.fingerprint === fingerprint ? prior.promise : prior.promise.then(() => prepare(asset, ownerHandle));
    const pending = (async () => {
      if (!verifyAnyWildsCard(asset).ok) throw new Error("wilds_roaming_source_card_invalid");
      const candidates: Array<{ source: WildzAdmittedArtifact; ancestors: Set<string> }> = [];
      const seen = new Set<string>(); let cursor: string | undefined;
      do {
        const page = await dependencies.sources.locateAsset(asset.id, cursor, 96);
        for (const sha of page.artifactSha256s) {
          if (seen.has(sha)) throw new Error("wilds_roaming_source_index_cycle"); seen.add(sha);
          const row = await dependencies.sources.read(sha);
          if (!row) throw new Error("wilds_roaming_source_missing");
          const bytes = receizBase64UrlDecode(row.artifact.exactBytesB64u);
          let source: WildzAdmittedArtifact;
          try { source = await open(bytes, row.artifact.filename, row.artifact.mimeType); }
          catch (cause) {
            // Skip only positively verified older document exports. A failed
            // native source must never silently trigger a replacement root.
            try { await openWildzSealedDocument({ bytes, mimeType: row.artifact.mimeType, name: row.artifact.filename }); }
            catch { throw cause; }
            continue;
          }
          if (source.compatibility !== "current-native") continue;
          if (source.artifactSha256 !== sha) throw new Error("wilds_roaming_source_digest_mismatch");
          const checked = await verifyReceizArtifact(new File([bytes.slice().buffer], row.artifact.filename, { type: row.artifact.mimeType }));
          if (checked.status !== "verified-artifact") throw new Error("wilds_roaming_source_verification_failed");
          const continuity = checked.verification.assetContinuity as { history?: Array<{ sourceArtifactSha256?: string }> } | undefined;
          candidates.push({ source, ancestors: new Set([...row.predecessors,
            ...(continuity?.history ?? []).flatMap(event => event.sourceArtifactSha256 ? [event.sourceArtifactSha256] : [])]) });
        }
        cursor = page.nextCursor ?? undefined;
      } while (cursor);
      if (candidates.length) {
        const descends = (candidate: typeof candidates[number], target: string, visited = new Set<string>()): boolean => {
          if (candidate.ancestors.has(target)) return true;
          if (visited.has(candidate.source.artifactSha256)) return false;
          visited.add(candidate.source.artifactSha256);
          return candidates.some(parent => candidate.ancestors.has(parent.source.artifactSha256) && descends(parent, target, visited));
        };
        const heads = candidates.filter(candidate => candidates.every(other => candidate === other || descends(candidate, other.source.artifactSha256)));
        if (heads.length !== 1) throw new Error("wilds_roaming_source_history_conflict");
        const source = heads[0]!.source;
        if (!sameWildzPlayerCoordinate(source.ownerReceizId, ownerHandle)) throw new Error("wilds_roaming_source_owner_mismatch");
        validateWildsRoamingHandoffCard(source.payloadBytes, asset);
        return source;
      }
      if (!sameWildzPlayerCoordinate(asset.manifest.ownerReceizId, ownerHandle)) throw new Error("wilds_roaming_source_owner_mismatch");
      const png = await (dependencies.renderCard ?? portableCardPngBlobForIdentityOwnership)(asset);
      const bytes = new Uint8Array(await png.arrayBuffer());
      validateWildsRoamingHandoffCard(bytes, asset);
      const response = await fetchImpl("/api/wilds/roaming/capture?action=prepare", { method: "POST", credentials: "same-origin", cache: "no-store",
        headers: { "content-type": "image/png", "x-wildz-artifact-filename": encodeURIComponent(`${asset.id}.png`) }, body: bytes });
      if (!response.ok) throw new Error(`wilds_roaming_source_prepare_http_${response.status}`);
      const exact = new Uint8Array(await response.arrayBuffer());
      const source = await open(exact, `${asset.id}.receized`, response.headers.get("content-type") ?? "application/octet-stream");
      if (source.compatibility !== "current-native" || !sameWildzPlayerCoordinate(source.ownerReceizId, ownerHandle)) throw new Error("wilds_roaming_source_owner_mismatch");
      validateWildsRoamingHandoffCard(source.payloadBytes, asset);
      await dependencies.sources.retain({ bytes: source.artifactBytes, filename: source.filename, mimeType: source.mimeType, assetId: asset.id });
      return source;
    })();
    active.set(key, { fingerprint, promise: pending }); void pending.finally(() => { if (active.get(key)?.promise === pending) active.delete(key); }).catch(() => undefined);
    return pending;
  };
}

let defaultPreparer: ReturnType<typeof createWildsRoamingOwnerFilePreparer> | undefined;
export async function prepareWildsRoamingOwnerFile(asset: PortableCardAsset, ownerHandle: string) {
  if (!defaultPreparer) {
    const { defaultWildzProofSourceRepository } = await import("./wildz-identity-adapter");
    defaultPreparer ??= createWildsRoamingOwnerFilePreparer({ sources: defaultWildzProofSourceRepository });
  }
  return defaultPreparer(asset, ownerHandle);
}
