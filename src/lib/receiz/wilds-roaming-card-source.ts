import { receizBase64UrlDecode, type ReceizClient } from "@receiz/sdk";
import { readWildzProofAppendsFromPng, verifyPortableCardPng, verifyPortableVaultPng, readPortableVaultFromPng } from "../../features/play/card-export";
import { cardArtifactFingerprint } from "../../features/play/prepared-card-artifact";
import { verifyAnyWildsCard, type PortableCardAsset } from "../../features/play/portable-card";
import { openWildzArtifactEvidence, type WildzAdmittedArtifact } from "./wildz-artifact-custody";
import { createWildzExportProofObject, type WildzExportProofObjectActor } from "./wildz-proof-object-export";
import type { createWildzProofSourceRepository } from "./wildz-proof-source-repository";
import { openWildzSealedDocument } from "./wildz-sealed-document";
import { sameWildzPlayerCoordinate } from "./wildz-player-coordinate";

type Sources = Pick<ReturnType<typeof createWildzProofSourceRepository>, "read" | "locateAsset" | "retain">;
export type WildsRoamingCardSource = Readonly<{
  assetId: string;
  cardFingerprint: string;
  admitted: WildzAdmittedArtifact;
  reused: boolean;
}>;

/** The source index includes whole-Vault backups under each carried card ID.
 * A verified backup is history, not a candidate for releasing one creature. */
export function isWildsRoamingVaultBackup(bytes: Uint8Array, assetId: string) {
  try {
    return verifyPortableVaultPng(bytes).ok
      && readPortableVaultFromPng(bytes).assets.some(card => card.id === assetId);
  } catch { return false; }
}

/** A capturable source carries one exact card, never a Vault, identity trailer,
 * embedded proof object, or unrelated private PNG metadata. Does not change bytes. */
export function verifyWildsRoamingCardPayload(bytes: Uint8Array, asset: PortableCardAsset) {
  const allowed = new Set(["IHDR", "PLTE", "IDAT", "IEND", "tRNS", "sRGB", "gAMA", "cHRM", "pHYs", "rzCd", "rzWx"]);
  let offset = 8, ended = false;
  while (offset + 12 <= bytes.length) {
    const size = new DataView(bytes.buffer, bytes.byteOffset + offset, 4).getUint32(0);
    const kind = new TextDecoder().decode(bytes.subarray(offset + 4, offset + 8));
    if (!allowed.has(kind) || size > bytes.length - offset - 12) throw new Error("wilds_roaming_source_not_single_card");
    offset += size + 12;
    if (kind === "IEND") { ended = size === 0 && offset === bytes.length; break; }
  }
  if (!ended) throw new Error("wilds_roaming_source_not_single_card");
  const proof = verifyPortableCardPng(bytes);
  const appends = readWildzProofAppendsFromPng(bytes);
  if (appends.length > 1 || appends.some(append => append.kind === "player-vault")) throw new Error("wilds_roaming_source_not_single_card");
  const append = appends[0];
  const current = append && append.kind !== "player-vault" ? append.asset : proof.asset;
  if (!proof.ok || !proof.asset || proof.asset.id !== asset.id || !current || !verifyAnyWildsCard(current).ok
    || (append && (append.kind === "player-vault" || append.base.assetId !== proof.asset.id || append.base.proofDigest !== proof.asset.proof.digest))
    || cardArtifactFingerprint(current) !== cardArtifactFingerprint(asset)) {
    throw new Error("wilds_roaming_source_card_mismatch");
  }
}

/** Uses only existing SDK native artifact operations and exact source storage.
 * Every call reopens retained bytes; a changed account cannot reuse cached authority.
 * PNG creation is lazy and used only for the first native admission of this asset. */
export function createWildsRoamingCardSourcePreparer(dependencies: Readonly<{
  sources: Sources;
  client: Readonly<{ assets: Pick<ReceizClient["assets"], "createProofObject">; artifacts: Pick<ReceizClient["artifacts"], "verifyAndOpen" | "download"> }>;
}>) {
  const active = new Map<string, Promise<WildsRoamingCardSource>>();
  return function prepare(input: Readonly<{
    actor: WildzExportProofObjectActor;
    asset: PortableCardAsset;
    initialCardPng?: Readonly<{ bytes: Uint8Array; filename: string }>;
  }>): Promise<WildsRoamingCardSource> {
    const asset = structuredClone(input.asset), actor = { ...input.actor };
    const initial = input.initialCardPng ? { bytes: input.initialCardPng.bytes.slice(), filename: input.initialCardPng.filename } : undefined;
    const fingerprint = cardArtifactFingerprint(asset);
    const key = JSON.stringify([actor.profileHandle, actor.actorId, actor.receizUserId, asset.id, fingerprint]);
    const existing = active.get(key);
    if (existing) return existing;
    const operation = (async () => {
      if (!verifyAnyWildsCard(asset).ok) throw new Error("wilds_roaming_source_card_invalid");
      const candidates: Array<{ admitted: WildzAdmittedArtifact; ancestors: Set<string> }> = [];
      let cursor: string | undefined;
      const visited = new Set<string>();
      do {
        const page = await dependencies.sources.locateAsset(asset.id, cursor, 96);
        for (const sha of page.artifactSha256s) {
          if (visited.has(sha)) throw new Error("wilds_roaming_source_index_cycle");
          visited.add(sha);
          const source = await dependencies.sources.read(sha);
          if (!source) throw new Error("wilds_roaming_source_missing");
          const bytes = receizBase64UrlDecode(source.artifact.exactBytesB64u);
          let opened: Awaited<ReturnType<typeof openWildzArtifactEvidence>>;
          try {
            opened = await openWildzArtifactEvidence(new File([bytes.slice().buffer], source.artifact.filename,
              { type: source.artifact.mimeType }), source.artifact.filename, dependencies.client.artifacts);
          } catch (nativeFailure) {
            // Positively verify a document-profile export before skipping it. MIME,
            // index metadata or a failed native verification alone never suffice.
            try { await openWildzSealedDocument({ bytes, mimeType: source.artifact.mimeType, name: source.artifact.filename }); }
            catch { throw nativeFailure; }
            continue;
          }
          if (opened.admitted.artifactSha256 !== sha) throw new Error("wilds_roaming_source_digest_mismatch");
          // Document-seal exports are read compatibility, never native custody.
          if (opened.admitted.compatibility !== "current-native" || opened.sealedArtifact.continuity.carrier !== "native-record-seal") continue;
          if (isWildsRoamingVaultBackup(opened.admitted.payloadBytes, asset.id)) continue;
          const continuity = opened.sealedArtifact.verification.assetContinuity as { history?: Array<{ sourceArtifactSha256?: string }> } | undefined;
          candidates.push({ admitted: opened.admitted, ancestors: new Set([
            ...source.predecessors, ...(continuity?.history ?? []).flatMap(event => event.sourceArtifactSha256 ? [event.sourceArtifactSha256] : [])
          ]) });
        }
        cursor = page.nextCursor ?? undefined;
      } while (cursor);
      if (candidates.length) {
        // Index order is not currentness. Only an exact carried descendant wins.
        const heads = candidates.filter(candidate => candidates.every(other => other === candidate
          || candidate.ancestors.has(other.admitted.artifactSha256)));
        if (heads.length !== 1) throw new Error("wilds_roaming_source_history_conflict");
        const admitted = heads[0]!.admitted;
        if (!sameWildzPlayerCoordinate(admitted.ownerReceizId, actor.profileHandle)) throw new Error("wilds_roaming_source_owner_mismatch");
        verifyWildsRoamingCardPayload(admitted.payloadBytes, asset);
        return { assetId: asset.id, cardFingerprint: fingerprint, admitted, reused: true };
      }
      if (!initial) throw new Error("wilds_roaming_initial_card_required");
      verifyWildsRoamingCardPayload(initial.bytes, asset);
      const { admitted } = await createWildzExportProofObject({ actor, bytes: initial.bytes, filename: initial.filename,
        kind: "card", createProofObject: dependencies.client.assets.createProofObject, artifacts: dependencies.client.artifacts });
      verifyWildsRoamingCardPayload(admitted.payloadBytes, asset);
      // Retention is required before releasing a newly claimable source, so another
      // roam cannot quietly mint a new enclosing identity after losing its source.
      await dependencies.sources.retain({ bytes: admitted.artifactBytes, filename: admitted.filename, mimeType: admitted.mimeType, assetId: asset.id });
      return { assetId: asset.id, cardFingerprint: fingerprint, admitted, reused: false };
    })();
    active.set(key, operation);
    void operation.finally(() => { if (active.get(key) === operation) active.delete(key); }).catch(() => undefined);
    return operation;
  };
}
