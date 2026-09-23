import { activeReceizSignatureV4SignerFromEnrollment, enrollReceizSignatureV4DeviceFromServer, verifyReceizSignatureV4SignerReadiness } from "./reference/receizSignatureV4Enrollment";
import { prewarmDocumentSealGroth16Runtime } from "./reference/realGroth16ProofClient";
import { createWildzIdentityRepository } from "../wildz-identity-repository";
import type { WildzGameImageKind } from "../wildz-game-image-export";
import { sealWildzCardLocally } from "./seal-card";

let readiness: Promise<NonNullable<Awaited<ReturnType<typeof activeReceizSignatureV4SignerFromEnrollment>>>> | null = null;

/** One device enrollment, then local signing. No card bytes leave the browser. */
export function prepareWildzLocalCardSealer(): Promise<NonNullable<Awaited<ReturnType<typeof activeReceizSignatureV4SignerFromEnrollment>>>> {
  if (typeof window === "undefined" || !window.indexedDB) return Promise.reject(new Error("wildz_local_signer_storage_unavailable"));
  if (!readiness) readiness = (async () => {
    const runtime = prewarmDocumentSealGroth16Runtime();
    void runtime.catch(() => {});
    let signer = await activeReceizSignatureV4SignerFromEnrollment();
    if (!signer) {
      const result = await enrollReceizSignatureV4DeviceFromServer();
      signer = await activeReceizSignatureV4SignerFromEnrollment();
      if (!signer) throw new Error(`wildz_local_signer_setup_failed:${result.reason ?? "unavailable"}`);
    }
    if (!await verifyReceizSignatureV4SignerReadiness(signer)) throw new Error("wildz_local_signer_not_ready");
    await runtime;
    return signer;
  })().catch(error => { readiness = null; throw error; });
  return readiness.then(signer => {
    if (signer.cert.expiresAtMs < Date.now()) {
      readiness = null;
      return prepareWildzLocalCardSealer();
    }
    return signer;
  });
}

export async function sealWildzOwnedCardBlob(payload: Blob, filename: string, kind: WildzGameImageKind) {
  const signer = await prepareWildzLocalCardSealer();
  const session = await createWildzIdentityRepository().active();
  return sealWildzCardLocally({ kind, mapOwner: session?.username ?? undefined, payload: new Uint8Array(await payload.arrayBuffer()), filename, signer });
}
