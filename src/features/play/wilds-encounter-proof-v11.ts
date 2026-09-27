import { canonicalPortableCardJson, sha256PortableBasis } from "./portable-card";
import * as ed25519 from "@noble/ed25519";
import { sha512 } from "@noble/hashes/sha2.js";
import { deriveUniformRarityDraw, rarityBand, rarityClass, WILDS_RARITY_LAW_V11 } from "./wilds-rarity-law-v11";
import { parseWildsWorldAddress, type WildsWorldAddress } from "./wilds-world-address";

export const WILDS_ENCOUNTER_PROOF_V11 = "wildz.encounter-proof.v11" as const;
ed25519.hashes.sha512 = sha512;
export type WildsEncounterInputV11 = Readonly<{
  schema: "wildz.encounter-input.v11";
  keyId: string;
  law: typeof WILDS_RARITY_LAW_V11;
  actorId: string;
  site: WildsWorldAddress;
  slot: number;
}>;
export type WildsV11EncounterResult = Readonly<{
  schema: typeof WILDS_ENCOUNTER_PROOF_V11;
  input: WildsEncounterInputV11;
  signatureB64u: string;
  draw: number;
  className: ReturnType<typeof rarityClass>;
  creatureSeed: string;
}>;

export function canonicalEncounterInputV11(input: WildsEncounterInputV11): string {
  if (input?.schema !== "wildz.encounter-input.v11" || input.law !== WILDS_RARITY_LAW_V11
    || typeof input.actorId !== "string" || !/^[a-z0-9:._-]{3,180}$/i.test(input.actorId)
    || typeof input.keyId !== "string" || !/^[a-z0-9._-]{3,80}$/i.test(input.keyId)
    || !Number.isInteger(input.slot) || input.slot < 0 || input.slot > 5) {
    throw new Error("wilds_v11_encounter_input_invalid");
  }
  const site = parseWildsWorldAddress(input.site);
  return canonicalPortableCardJson({ schema: input.schema, keyId: input.keyId, law: input.law, actorId: input.actorId, site, slot: input.slot });
}

function signatureBytes(value: string): Uint8Array {
  if (!/^[A-Za-z0-9_-]{86}$/.test(value)) throw new Error("wilds_v11_signature_invalid");
  const padded = value.replace(/-/g, "+").replace(/_/g, "/") + "==";
  const bytes = Uint8Array.from(atob(padded), character => character.charCodeAt(0));
  if (bytes.length !== 64) throw new Error("wilds_v11_signature_invalid");
  return bytes;
}

function publicKeyBytes(value: string): Uint8Array {
  if (!/^[A-Za-z0-9_-]{43}$/.test(value)) throw new Error("wilds_v11_public_key_invalid");
  return Uint8Array.from(atob(value.replace(/-/g, "+").replace(/_/g, "/") + "="), character => character.charCodeAt(0));
}

export function projectEncounterResultV11(input: WildsEncounterInputV11, signatureB64u: string): WildsV11EncounterResult {
  canonicalEncounterInputV11(input);
  const signature = signatureBytes(signatureB64u);
  const draw = deriveUniformRarityDraw(signature);
  return {
    schema: WILDS_ENCOUNTER_PROOF_V11,
    input,
    signatureB64u,
    draw,
    className: rarityClass(rarityBand(input.site), draw),
    creatureSeed: sha256PortableBasis(`${WILDS_ENCOUNTER_PROOF_V11}\0creature\0${signatureB64u}`)
  };
}

/** Entirely local verification; key pinning belongs to the published release manifest. */
export async function verifyEncounterResultV11(result: WildsV11EncounterResult, pinnedKeys: Readonly<Record<string, string>>): Promise<boolean> {
  try {
    if (result.schema !== WILDS_ENCOUNTER_PROOF_V11) return false;
    const exact = canonicalEncounterInputV11(result.input);
    const expected = projectEncounterResultV11(result.input, result.signatureB64u);
    if (canonicalPortableCardJson(result) !== canonicalPortableCardJson(expected)) return false;
    const pinned = pinnedKeys[result.input.keyId];
    if (!pinned) return false;
    const key = await crypto.subtle.importKey("raw", publicKeyBytes(pinned).slice().buffer, { name: "Ed25519" }, false, ["verify"]);
    return await crypto.subtle.verify({ name: "Ed25519" }, key, signatureBytes(result.signatureB64u).slice().buffer,
      new TextEncoder().encode(exact));
  } catch {
    return false;
  }
}

/** Synchronous local verification for restore and inventory admission. */
export function verifyEncounterResultV11Sync(result: WildsV11EncounterResult, pinnedKeys: Readonly<Record<string, string>>): boolean {
  try {
    if (result.schema !== WILDS_ENCOUNTER_PROOF_V11) return false;
    const exact = canonicalEncounterInputV11(result.input);
    const expected = projectEncounterResultV11(result.input, result.signatureB64u);
    if (canonicalPortableCardJson(result) !== canonicalPortableCardJson(expected)) return false;
    const pinned = pinnedKeys[result.input.keyId];
    return !!pinned && ed25519.verify(signatureBytes(result.signatureB64u), new TextEncoder().encode(exact), publicKeyBytes(pinned), { zip215: false });
  } catch {
    return false;
  }
}
