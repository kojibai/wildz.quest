import { hasWildzCardSealPayload, unpackWildzCardSealPayload } from "./wildz-card-seal-payload";
import { isWildzPng } from "./wildz-png-envelope";
import { readReceizIdentityArtifact } from "@receiz/sdk";

/** Recovery exports can contain a plaintext private key. They require local
 * sealing; never send that key to an application server or sealing service. */
export async function assertWildzRemoteSealPayloadSafe(bytes: Uint8Array) {
  if (isWildzPng(bytes) && hasWildzCardSealPayload(bytes)) bytes = await unpackWildzCardSealPayload(bytes);
  let identity;
  try {
    identity = await readReceizIdentityArtifact(bytes);
  } catch (error) {
    if (error instanceof Error && error.message === "receiz_key_identity_record_missing") return;
    throw error;
  }
  if (identity.crypto.privateKeyPkcs8B64u)
    throw new Error("wildz_private_identity_requires_local_sealing");
}
