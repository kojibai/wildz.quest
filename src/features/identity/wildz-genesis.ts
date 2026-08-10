import { canonicalPortableCardJson, sha256PortableBasis } from "../play/portable-card";
import { deriveKaiKlokMoment } from "../play/kai-klok-moment";

export type WildzGender = "female" | "male";

export type WildzCharacterTraits = {
  hair: string;
  complexion: string;
  outfit: string;
  primaryColor: string;
  secondaryColor: string;
  material: string;
  accessory: string;
  trail: string;
  signatureMark: string;
};

export type WildzCharacterGenesis = {
  schema: "wildz.character_genesis.v1";
  version: 1;
  identityRef: string;
  kaiPulse: string;
  gender: WildzGender;
  traits: WildzCharacterTraits;
  digest: string;
};

export const WILDZ_CHARACTER_STORAGE_KEY = "wildz:character:v1";

export function parseWildzCharacter(raw: string | null): WildzCharacterGenesis | null {
  if (!raw) return null;
  try {
    const value = JSON.parse(raw) as Partial<WildzCharacterGenesis>;
    if (value.schema !== "wildz.character_genesis.v1" || value.version !== 1) return null;
    if (typeof value.identityRef !== "string" || !/^\d{1,32}$/.test(value.kaiPulse ?? "")) return null;
    if (value.gender !== "female" && value.gender !== "male") return null;
    if (!value.traits || typeof value.digest !== "string" || !/^[a-f0-9]{64}$/.test(value.digest)) return null;
    const expected = generateWildzCharacter({ identityRef: value.identityRef, kaiPulse: value.kaiPulse!, gender: value.gender, version: 1 });
    return expected.digest === value.digest ? expected : null;
  } catch {
    return null;
  }
}

const TRAITS = {
  hair: ["canopy-crop", "river-braid", "moss-wave", "ember-coil", "cloud-sweep", "fern-locks"],
  complexion: ["dawn", "clay", "copper", "umber", "mahogany", "night-bloom"],
  outfit: ["trailweaver", "rift-scout", "grove-runner", "pulse-keeper", "atlas-rover", "canopy-guard"],
  primaryColor: ["#78D98B", "#4ABFA3", "#E6B84A", "#E77761", "#7099E8", "#A67AD4"],
  secondaryColor: ["#173E32", "#1E3650", "#4B3322", "#4A2335", "#29324C", "#32372B"],
  material: ["woven-leaf", "soft-shell", "river-hide", "prism-knit", "bark-plate", "mist-fiber"],
  accessory: ["seed-pin", "atlas-band", "rift-charm", "pulse-lens", "trail-satchel", "spore-cuff"],
  trail: ["firefly", "mint-ripple", "amber-leaf", "prism-dust", "blue-mist", "petal-spark"],
  signatureMark: ["sprout", "crescent", "river", "star-seed", "mountain", "spiral"]
} as const;

function pick<T>(values: readonly T[], digest: string, offset: number) {
  return values[Number.parseInt(digest.slice(offset, offset + 4), 16) % values.length]!;
}

export function generateWildzCharacter(input: {
  identityRef: string;
  kaiPulse: string;
  gender: WildzGender;
  version: 1;
}): WildzCharacterGenesis {
  if (!input.identityRef.trim()) throw new Error("wildz_genesis_identity_required");
  if (!/^\d{1,32}$/.test(input.kaiPulse)) throw new Error("wildz_genesis_kai_pulse_invalid");

  const seed = sha256PortableBasis(canonicalPortableCardJson(input)).slice(7);
  const traits: WildzCharacterTraits = {
    hair: pick(TRAITS.hair, seed, 0),
    complexion: pick(TRAITS.complexion, seed, 4),
    outfit: pick(TRAITS.outfit, seed, 8),
    primaryColor: pick(TRAITS.primaryColor, seed, 12),
    secondaryColor: pick(TRAITS.secondaryColor, seed, 16),
    material: pick(TRAITS.material, seed, 20),
    accessory: pick(TRAITS.accessory, seed, 24),
    trail: pick(TRAITS.trail, seed, 28),
    signatureMark: pick(TRAITS.signatureMark, seed, 32)
  };
  const canonical = {
    schema: "wildz.character_genesis.v1" as const,
    version: input.version,
    identityRef: input.identityRef,
    kaiPulse: input.kaiPulse,
    gender: input.gender,
    traits
  };

  return { ...canonical, digest: sha256PortableBasis(canonicalPortableCardJson(canonical)).slice(7) };
}

export function generateIdentityBoundWildzCharacter(identity: {
  keyId: string;
  createdAt?: string | null;
}): WildzCharacterGenesis {
  if (!identity.keyId.trim()) throw new Error("wildz_genesis_identity_required");
  if (!identity.createdAt) throw new Error("wildz_genesis_account_creation_required");
  const kaiPulse = String(deriveKaiKlokMoment({
    occurredAt: identity.createdAt,
    authority: "admitted"
  }).pulse);
  if (!/^\d{1,32}$/.test(kaiPulse)) throw new Error("wildz_genesis_kai_pulse_invalid");
  const presentationSeed = sha256PortableBasis(canonicalPortableCardJson({
    identityRef: identity.keyId,
    kaiPulse,
    purpose: "wildz.explorer.presentation.v1"
  })).slice(7);
  const gender: WildzGender = Number.parseInt(presentationSeed.slice(0, 2), 16) % 2 === 0 ? "female" : "male";
  return generateWildzCharacter({
    identityRef: identity.keyId,
    kaiPulse,
    gender,
    version: 1
  });
}
