import { createReceizClient, readReceizIdentityArtifact, receizKaiNow, sha256ReceizBytes } from "@receiz/sdk";
import { openWildzArtifactEvidence } from "../wildz-artifact-custody";
import { requireWildzIdentityBindingFromEnvelope } from "../wildz-identity-binding";
import { readWildsMapFromPng } from "../../../features/play/wilds-map-image";
import { requireVerifiedWildzPng } from "../wildz-proof-object-export";
import { splitWildzPngEnvelope } from "../wildz-png-envelope";
import { sameWildzPlayerCoordinate } from "../wildz-player-coordinate";
import { packWildzCardSealPayload as packWildzCardPayload, unpackWildzCardSealPayload as unpackWildzCardPayload } from "../wildz-card-seal-payload";
import { buildReceizCanonicalIdentity, buildReceizProofBundle, createReceizNativeOwnershipGenesis, encodeReceizProofBundle, RECEIZ_PROOF_BUNDLE_CHUNK_KEY } from "./reference/receizProofBundle";
import { insertPngTextChunks, countPngTextChunksByKeyword } from "./reference/pngChunks";
import { maybeSignReceizBundleV4, type ReceizBundleSignatureV4Signer } from "./reference/receizSignatureV4";
import { verifyReceizSignatureV4SignerReadiness } from "./reference/receizSignatureV4Enrollment";
import { generateDocumentSealGroth16ProofClient } from "./reference/realGroth16ProofClient";
import { formatReceizTimestampNY } from "./reference/time";
import { buildKaiKlockResponseFromPulse } from "./reference/kai_pulse";
import { hmacHex } from "./reference/sign";

// Public deterministic proof-input domain; authenticity comes from Signature V4.
const PROOF_DOMAIN = "receiz-document-seal-offline-v1";
const localArtifacts = createReceizClient({ fetchImpl: async () => { throw new Error("wildz_local_verification_network_forbidden"); } }).artifacts;

export async function openCanonicalWildzCard(bytes: Uint8Array, filename = "wildz-card.png") {
  const { admitted } = await openWildzArtifactEvidence(new Blob([bytes.slice().buffer], { type: "image/png" }), filename, localArtifacts);
  if (admitted.compatibility !== "current-native") throw new Error("wildz_card_native_seal_required");
  const payload = await unpackWildzCardPayload(admitted.payloadBytes);

  return { admitted, payload };
}

/** Native PNG genesis for a signed application payload. An existing enclosing
 * artifact must be reused or appended through the SDK, never passed as payload. */
export async function sealWildzCardLocally(input: {
  payload: Uint8Array;
  filename: string;
  signer: ReceizBundleSignatureV4Signer;
  prove?: typeof generateDocumentSealGroth16ProofClient;
  kind?: "card" | "vault" | "identity" | "map";
  mapOwner?: string;
}) {
  if (!await verifyReceizSignatureV4SignerReadiness(input.signer)) throw new Error("wildz_local_signer_not_ready");
  if (countPngTextChunksByKeyword(splitWildzPngEnvelope(input.payload).pngBasis, RECEIZ_PROOF_BUNDLE_CHUNK_KEY))
    throw new Error("wildz_existing_proof_must_be_reused_or_transitioned");
  let playerId: string;
  if (input.kind === "map") {
    readWildsMapFromPng(input.payload);
    if (!input.mapOwner) throw new Error("wildz_map_owner_required");
    playerId = input.mapOwner;
  } else if (input.kind === "identity") {
    const identity = await readReceizIdentityArtifact(input.payload);
    if (!identity.owner.username) throw new Error("wildz_identity_owner_required");
    playerId = identity.owner.username;
  } else if (splitWildzPngEnvelope(input.payload).trailer.length) {
    playerId = (await requireWildzIdentityBindingFromEnvelope(input.payload)).playerId;
  } else {
    playerId = requireVerifiedWildzPng(input.kind ?? "card", input.payload);
    if (!input.mapOwner || !sameWildzPlayerCoordinate(playerId, input.mapOwner))
      throw new Error("wildz_proof_object_owner_mismatch");
  }
  const owner = `${playerId.replace(/\.receiz\.id$/, "")}.receiz.id`;
  const basis = await packWildzCardPayload(input.payload);
  const basisSha256 = await sha256ReceizBytes(basis);
  const createdAtMs = Date.now();
  const pulse = String(receizKaiNow().pulse);
  const ts = formatReceizTimestampNY(new Date(createdAtMs));
  const slug = ts.replace(/-/g, "").replace(/:/g, "").replace(/ /g, "_");
  const code = (await hmacHex(`receiz|${ts}|${pulse}|v2`, PROOF_DOMAIN)).slice(0, 8).toUpperCase();
  const verifyPath = `/v/${slug}/${code}/${pulse}`;
  const anchorId = (await sha256ReceizBytes(new TextEncoder().encode(`${code}:${pulse}::${basisSha256}`))).slice(0, 8);
  const canonicalIdentity = buildReceizCanonicalIdentity({ payloadVersion: "v2", canonicalTs24: ts, slug, code, kaiPulseEternal: pulse });
  const zk = await (input.prove ?? generateDocumentSealGroth16ProofClient)({ signingKey: PROOF_DOMAIN, canonicalIdentity, artifactSha256Basis: basisSha256 });
  const kai = await buildKaiKlockResponseFromPulse(BigInt(pulse));
  const bundle = await buildReceizProofBundle({ payloadVersion: "v2", createdAtMs, ts, code, slug, verifyPath,
    verifyUrl: `https://receiz.com${verifyPath}?a=${anchorId}&ms=${createdAtMs}`, kaiPulseEternal: pulse,
    kaiKlok: kai.compressed_summary, signingKey: PROOF_DOMAIN, anchorId, ...zk, artifactSha256Basis: basisSha256 });
  const unsigned = { ...bundle, nativeRecordSeal: {
    schema: "receiz.native_record_seal.v1" as const, ownerReceizId: owner, recordId: `native:${basisSha256}`,
    payload: { filename: input.filename, mimeType: "image/png", sha256: basisSha256 },
    ownershipContinuity: await createReceizNativeOwnershipGenesis({ artifactId: basisSha256,
      namespace: `receiz.native-proof:${basisSha256}`, ownerReceizId: owner, headReference: bundle.receizClaimId })
  } };
  const signatureV4 = await maybeSignReceizBundleV4(unsigned, input.signer);
  if (!signatureV4) throw new Error("wildz_local_signature_failed");
  const bytes = insertPngTextChunks(basis, [{ keyword: RECEIZ_PROOF_BUNDLE_CHUNK_KEY,
    text: await encodeReceizProofBundle({ ...unsigned, signatureV4 }) }]);
  const opened = await openCanonicalWildzCard(bytes, input.filename);
  if (!sameWildzPlayerCoordinate(owner, opened.admitted.ownerReceizId)) throw new Error("wildz_sealed_owner_mismatch");
  if (await sha256ReceizBytes(opened.payload) !== await sha256ReceizBytes(input.payload)) throw new Error("wildz_card_export_payload_mismatch");
  return { bytes: bytes.slice(), filename: input.filename, mimeType: "image/png" as const };
}
