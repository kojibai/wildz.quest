import {
  createReceizArtifactAdmissionEngine, readReceizIdentityPublicBinding, receizBase64UrlDecode, verifyReceizArtifact,
  type ReceizIdentityLoginProof, type ReceizPortableSealedArtifactV124,
} from "@receiz/sdk";
import { createReceizOfflineSealer } from "@receiz/sdk/offline";
import { loadWildzLocalSealResources } from "./resources";
import { createWildzBrowserSealStore } from "./store";
import type { WildsResourceSourceAuthorV128 } from "../wilds-resource-source-v128";

export async function openWildzMarketReplaySealer(input: {
  author: WildsResourceSourceAuthorV128;
  identity: { original: ReceizPortableSealedArtifactV124; challenge: string; proof: ReceizIdentityLoginProof };
}) {
  const { author, identity } = input;
  const { original } = identity;
  const bytes = new Uint8Array(receizBase64UrlDecode(original.exactBytesB64u));
  const verification = await verifyReceizArtifact(new File([bytes], original.filename, { type: original.mimeType }));
  if (verification.status !== "verified-artifact" || verification.artifactDigest.value !== original.artifactSha256
    || verification.payloadDigest.value !== original.payloadSha256) throw Error("wildz_market_identity_original_invalid");
  const admission = await createReceizArtifactAdmissionEngine()(verification, {
    profile: "identity", actorConstraint: author.keyFile.owner.uid,
    identityExactChallenge: identity.challenge, identityProof: identity.proof,
  });
  const binding = await readReceizIdentityPublicBinding(admission);
  if (binding.keyId !== author.keyFile.keyId || binding.publicKeyRawB64u !== author.keyFile.crypto.publicKeyRawB64u
    || binding.artifactOwnerReceizId !== author.ownerReceizId) throw Error("wildz_market_identity_owner_mismatch");

  const resources = await loadWildzLocalSealResources();
  const sealer = createReceizOfflineSealer({ resources, store: await createWildzBrowserSealStore(resources),
    ownerIdentityAdmission: admission, enrollmentUrl: "/api/receiz/local-signer/enroll" });
  if (!await sealer.ready()) await sealer.enroll();
  return sealer;
}
