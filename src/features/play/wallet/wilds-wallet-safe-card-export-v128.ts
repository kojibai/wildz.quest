import { appendReceizIdentityArtifactTrailerToPng, readReceizIdentityArtifact, RECEIZ_IDENTITY_RECORD_KEY_CHUNK_KEY } from "@receiz/sdk";
import { withWildzPngPayloadChunk } from "../card-export";
import { appendWildzIdentityBindingTrailer, requireWildzIdentityBindingFromEnvelope } from "../../../lib/receiz/wildz-identity-binding";
import { splitWildzPngEnvelope } from "../../../lib/receiz/wildz-png-envelope";
import { createWildzIdentityAuthorizationArtifact } from "../../../lib/receiz/wildz-identity-authorization-artifact";

/** Only use after the enclosing Original is independently verified. The card,
 * Vault PNG namespaces and ORIGINAL device signature remain byte-for-byte.
 * Replace only the Identity transport trailer with a real encrypted envelope
 * of the SAME key, excluding private account archives. No new signer/ID. */
export async function createSafeWildsWalletCardExportV128(verifiedPayload: Uint8Array) {
  const original = await readReceizIdentityArtifact(verifiedPayload);
  const binding = await requireWildzIdentityBindingFromEnvelope(verifiedPayload);
  const safe = await readReceizIdentityArtifact((await createWildzIdentityAuthorizationArtifact(original)).artifact);
  if (safe.crypto.privateKeyPkcs8B64u || safe.keyId !== original.keyId || safe.owner.uid !== original.owner.uid || safe.alg !== original.alg
    || safe.crypto.publicKeyRawB64u !== original.crypto.publicKeyRawB64u || binding.keyId !== safe.keyId) throw Error("The safe card export changed the held identity.");
  const { pngBasis } = splitWildzPngEnvelope(verifiedPayload);
  // The SDK may have duplicated the identity in its standard PNG namespace.
  // Remove that transport copy too before attaching the encrypted SAME key.
  const png = withWildzPngPayloadChunk(pngBasis, RECEIZ_IDENTITY_RECORD_KEY_CHUNK_KEY, null);
  const bytes = appendWildzIdentityBindingTrailer(appendReceizIdentityArtifactTrailerToPng(png, safe), binding);
  const reopened = await readReceizIdentityArtifact(bytes);
  if (reopened.crypto.privateKeyPkcs8B64u || (await requireWildzIdentityBindingFromEnvelope(bytes)).signatureB64Url !== binding.signatureB64Url) throw Error("The safe card export lost its original device proof.");
  return bytes;
}
