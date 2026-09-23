import { receizBase64UrlDecode, receizBase64UrlEncode, sha256ReceizBytes, readReceizIdentityArtifact, serializeReceizIdentityArtifact, RECEIZ_IDENTITY_RECORD_KEY_CHUNK_KEY } from "@receiz/sdk";
import { readWildzPngPayloadChunks, withWildzPngPayloadChunk } from "../../features/play/card-export";
import { splitWildzPngEnvelope } from "./wildz-png-envelope";

const KEY = "wildz.identity-envelope.v1";

export function hasWildzCardSealPayload(bytes: Uint8Array) {
  return readWildzPngPayloadChunks(splitWildzPngEnvelope(bytes).pngBasis, KEY).length > 0;
}

/** Run before Record -> Seal: PNG canonicalization does not bind trailing bytes. */
export async function packWildzCardSealPayload(bytes: Uint8Array) {
  const { pngBasis, trailer } = splitWildzPngEnvelope(bytes);
  if (hasWildzCardSealPayload(pngBasis)) throw new Error("wildz_card_payload_already_packed");
  if (!trailer.length) return bytes;
  // Expose the same identity through the SDK's standard PNG namespace so other
  // Receiz applications can read the verified payload without Wildz decoding.
  const identity = await readReceizIdentityArtifact(bytes);
  const identityChunks = readWildzPngPayloadChunks(pngBasis, RECEIZ_IDENTITY_RECORD_KEY_CHUNK_KEY);
  if (identityChunks.length > 0 && (identityChunks.length !== 1
    || serializeReceizIdentityArtifact(await readReceizIdentityArtifact(pngBasis)) !== serializeReceizIdentityArtifact(identity)))
    throw new Error("wildz_card_identity_namespace_conflict");
  const addedIdentityChunk = identityChunks.length === 0;
  const basis = addedIdentityChunk
    ? withWildzPngPayloadChunk(pngBasis, RECEIZ_IDENTITY_RECORD_KEY_CHUNK_KEY, serializeReceizIdentityArtifact(identity))
    : pngBasis;
  return withWildzPngPayloadChunk(basis, KEY, JSON.stringify({
    schema: KEY, sha256: await sha256ReceizBytes(bytes), trailer: receizBase64UrlEncode(trailer), addedIdentityChunk
  }));
}

/** Domain decoding only; callers must verify the enclosing artifact first on import. */
export async function unpackWildzCardSealPayload(bytes: Uint8Array) {
  const { pngBasis, trailer: existingTrailer } = splitWildzPngEnvelope(bytes);
  const rows = readWildzPngPayloadChunks(pngBasis, KEY);
  if (!rows.length) return bytes;
  if (existingTrailer.length) throw new Error("wildz_card_payload_unbound_trailer");
  if (rows.length !== 1) throw new Error("wildz_card_payload_ambiguous");
  const row = JSON.parse(rows[0]!) as Record<string, unknown>;
  if (!row || row.schema !== KEY || typeof row.trailer !== "string"
    || row.trailer.length > 64 * 1024 * 1024 || typeof row.sha256 !== "string"
    || !/^[a-f0-9]{64}$/.test(row.sha256)) throw new Error("wildz_card_payload_invalid");
  let png = withWildzPngPayloadChunk(bytes, KEY, null);
  if (row.addedIdentityChunk === true) png = withWildzPngPayloadChunk(png, RECEIZ_IDENTITY_RECORD_KEY_CHUNK_KEY, null);
  const trailer = receizBase64UrlDecode(row.trailer);
  const restored = new Uint8Array(png.length + trailer.length);
  restored.set(png); restored.set(trailer, png.length);
  if (await sha256ReceizBytes(restored) !== row.sha256) throw new Error("wildz_card_payload_binding_invalid");
  return restored;
}
