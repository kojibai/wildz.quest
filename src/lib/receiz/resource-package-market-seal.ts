import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";
import { receizOAuthSecret } from "./oauth-state";

const PURPOSE = "wildz.resource-package-market.instrument.v1";
function key(secret: string) { return createHash("sha256").update(PURPOSE).update("\0").update(secret).digest(); }
export function sealResourcePackageMarketOffer(offer: unknown, listingId: string, secret = receizOAuthSecret()) {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key(secret), iv);
  cipher.setAAD(Buffer.from(`${PURPOSE}\0${listingId}`));
  const encrypted = Buffer.concat([cipher.update(JSON.stringify(offer), "utf8"), cipher.final()]);
  return ["v1", iv.toString("base64url"), encrypted.toString("base64url"), cipher.getAuthTag().toString("base64url")].join(".");
}
export function openResourcePackageMarketOffer(value: string, listingId: string, secret = receizOAuthSecret()): unknown {
  try {
    const [version, ivText, encryptedText, tagText, ...extra] = value.split(".");
    if (version !== "v1" || !ivText || !encryptedText || !tagText || extra.length || value.length > 2_000_000) throw new Error("shape");
    const iv = Buffer.from(ivText, "base64url"), tag = Buffer.from(tagText, "base64url");
    if (iv.length !== 12 || tag.length !== 16) throw new Error("shape");
    const decipher = createDecipheriv("aes-256-gcm", key(secret), iv);
    decipher.setAAD(Buffer.from(`${PURPOSE}\0${listingId}`)); decipher.setAuthTag(tag);
    return JSON.parse(Buffer.concat([decipher.update(Buffer.from(encryptedText, "base64url")), decipher.final()]).toString("utf8"));
  } catch { throw new Error("package_market_instrument_invalid"); }
}
