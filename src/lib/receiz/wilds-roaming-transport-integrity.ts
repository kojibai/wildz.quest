import { createCipheriv, createDecipheriv, createHmac, randomBytes } from "node:crypto";
import { canonicalPortableCardJson } from "../../features/play/portable-card";
import { receizOAuthSecret } from "./oauth-state";

export type WildsRoamingTransportEnvelope = { schema: "wildz.roaming-transport.v1"; nonce: string; ciphertext: string; tag: string };
function transportKey(purpose: string, secret: string) {
  if (!purpose || !secret) throw new Error("wilds_roaming_transport_secret_required");
  return createHmac("sha256", secret).update("wildz.roaming-transport.v1\0").update(purpose).digest();
}
/** Encrypted Wildz transport only; never native custody or a claim. Even a
 * publicly resolved app-state wrapper cannot expose an unclaimed bearer source. */
export function sealWildsRoamingTransport<T>(record: T, purpose: string, secret = receizOAuthSecret()): WildsRoamingTransportEnvelope {
  const nonce = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", transportKey(purpose, secret), nonce);
  cipher.setAAD(Buffer.from(purpose));
  const ciphertext = Buffer.concat([cipher.update(canonicalPortableCardJson(record), "utf8"), cipher.final()]);
  return { schema: "wildz.roaming-transport.v1", nonce: nonce.toString("base64url"), ciphertext: ciphertext.toString("base64url"), tag: cipher.getAuthTag().toString("base64url") };
}
export function openWildsRoamingTransport<T>(value: unknown, purpose: string, secret = receizOAuthSecret()): T {
  if (!value || typeof value !== "object") throw new Error("wilds_roaming_transport_invalid");
  const envelope = value as WildsRoamingTransportEnvelope;
  if (envelope.schema !== "wildz.roaming-transport.v1" || Object.keys(envelope).sort().join(",") !== "ciphertext,nonce,schema,tag"
    || typeof envelope.ciphertext !== "string" || !/^[A-Za-z0-9_-]{16}$/.test(envelope.nonce ?? "")
    || !/^[A-Za-z0-9_-]{22}$/.test(envelope.tag ?? "")) throw new Error("wilds_roaming_transport_invalid");
  try {
    const decipher = createDecipheriv("aes-256-gcm", transportKey(purpose, secret), Buffer.from(envelope.nonce, "base64url"));
    decipher.setAAD(Buffer.from(purpose));
    decipher.setAuthTag(Buffer.from(envelope.tag, "base64url"));
    return JSON.parse(Buffer.concat([decipher.update(Buffer.from(envelope.ciphertext, "base64url")), decipher.final()]).toString("utf8")) as T;
  } catch { throw new Error("wilds_roaming_transport_invalid"); }
}
