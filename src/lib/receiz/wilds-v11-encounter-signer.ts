import { createPrivateKey, sign } from "node:crypto";
import { canonicalEncounterInputV11, projectEncounterResultV11, type WildsEncounterInputV11 } from "@/features/play/wilds-encounter-proof-v11";

/** Server-only deterministic primitive. The admission service must authorize travel before calling it. */
export function signWildsV11Encounter(input: WildsEncounterInputV11, privateKeyPem: string) {
  const key = createPrivateKey(privateKeyPem);
  if (key.asymmetricKeyType !== "ed25519") throw new Error("wilds_v11_signing_key_invalid");
  const exact = canonicalEncounterInputV11(input);
  const signatureB64u = sign(null, new TextEncoder().encode(exact), key).toString("base64url");
  return projectEncounterResultV11(input, signatureB64u);
}
