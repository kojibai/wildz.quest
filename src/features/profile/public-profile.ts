import type { WildzCharacterGenesis } from "@/features/identity/wildz-genesis";

export type PublicWildzCard = {
  id: string;
  name: string;
  proofDigest: string;
  visibility: "public";
  status?: string;
  listedPriceCents?: number;
};

export type PublicWildzProfile = {
  schema: "wildz.public_profile.v1";
  username: string;
  displayName: string;
  avatarImageUrl: string | null;
  explorer: Pick<WildzCharacterGenesis, "gender" | "traits" | "digest"> | null;
  activeCompanion: PublicWildzCard | null;
  vault: PublicWildzCard[];
  achievements: string[];
  discoveries: number;
  record: { wins: number; losses: number; raids: number };
  team: string | null;
  league: string | null;
  reputation: number;
  listings: string[];
  activity: Array<{ id: string; label: string; at: string }>;
};

const clean = (value: unknown, limit = 80) => typeof value === "string" ? value.trim().slice(0, limit) : "";
const boundedInt = (value: unknown, max = 1_000_000) => Number.isFinite(value) ? Math.max(0, Math.min(max, Math.floor(Number(value)))) : 0;
const WILDZ_PUBLIC_HANDLE = /^[a-z0-9][a-z0-9._-]{0,63}$/;
const INLINE_PROFILE_IMAGE = /^data:image\/(?:png|jpeg|webp);base64,[a-z0-9+/=]+$/i;

function safeAvatarImageUrl(value: unknown) {
  if (typeof value !== "string") return null;
  const image = value.trim();
  if (!image || image.length > 220_000) return null;
  if (INLINE_PROFILE_IMAGE.test(image)) return image;
  try {
    const url = new URL(image);
    return url.protocol === "https:" ? url.toString().slice(0, 2_048) : null;
  } catch {
    return null;
  }
}
const EXPLORER_TRAIT_KEYS = [
  "hair",
  "complexion",
  "outfit",
  "primaryColor",
  "secondaryColor",
  "material",
  "accessory",
  "trail",
  "signatureMark"
] as const;

function sanitizeExplorer(value: unknown): PublicWildzProfile["explorer"] {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const explorer = value as Record<string, unknown>;
  if (explorer.gender !== "female" && explorer.gender !== "male") return null;
  if (!explorer.traits || typeof explorer.traits !== "object" || Array.isArray(explorer.traits)) return null;
  const traitsSource = explorer.traits as Record<string, unknown>;
  const traits = Object.fromEntries(EXPLORER_TRAIT_KEYS.map((key) => [key, clean(traitsSource[key], 64)]));
  if (Object.values(traits).some((trait) => !trait)) return null;
  const digest = clean(explorer.digest, 80);
  if (!/^sha256:[a-f0-9]{64}$/.test(digest) && !/^[a-f0-9]{64}$/.test(digest)) return null;
  return {
    gender: explorer.gender,
    traits: traits as WildzCharacterGenesis["traits"],
    digest
  };
}

export function canonicalWildzHandle(value: string) {
  const handle = value.trim().replace(/^@+/, "").toLowerCase();
  if (!WILDZ_PUBLIC_HANDLE.test(handle)) throw new Error("wildz_profile_handle_invalid");
  return `@${handle}`;
}

export function canonicalWildzProfilePath(value: string) {
  return `/u/${encodeURIComponent(canonicalWildzHandle(value).slice(1))}`;
}

export function sanitizePublicWildzProfile(input: Record<string, unknown>): PublicWildzProfile {
  const vault = Array.isArray(input.vault) ? input.vault.flatMap((raw) => {
    if (!raw || typeof raw !== "object") return [];
    const card = raw as Record<string, unknown>;
    if (card.visibility !== "public") return [];
    const id = clean(card.id, 160);
    const proofDigest = clean(card.proofDigest, 160);
    if (!id || !proofDigest) return [];
    return [{
      id,
      name: clean(card.name) || "Wildz companion",
      proofDigest,
      visibility: "public" as const,
      status: clean(card.status, 30) || undefined,
      listedPriceCents: Number.isFinite(card.listedPriceCents) ? boundedInt(card.listedPriceCents, 100_000_000) : undefined
    }];
  }).slice(0, 120) : [];
  const safeExplorer = sanitizeExplorer(input.explorer);
  const record = input.record && typeof input.record === "object" ? input.record as Record<string, unknown> : {};

  return {
    schema: "wildz.public_profile.v1",
    username: (() => {
      try { return canonicalWildzHandle(clean(input.username, 64)); }
      catch { return "@explorer"; }
    })(),
    displayName: clean(input.displayName) || "Wildz Explorer",
    avatarImageUrl: safeAvatarImageUrl(input.avatarImageUrl),
    explorer: safeExplorer,
    activeCompanion: vault.find((card) => card.id === input.activeCompanionId) ?? vault[0] ?? null,
    vault,
    achievements: Array.isArray(input.achievements) ? input.achievements.map((item) => clean(item, 64)).filter(Boolean).slice(0, 64) : [],
    discoveries: boundedInt(input.discoveries),
    record: { wins: boundedInt(record.wins), losses: boundedInt(record.losses), raids: boundedInt(record.raids) },
    team: clean(input.team, 64) || null,
    league: clean(input.league, 64) || null,
    reputation: boundedInt(input.reputation, 100_000),
    listings: Array.isArray(input.listings) ? input.listings.map((item) => clean(item, 160)).filter(Boolean).slice(0, 120) : [],
    activity: Array.isArray(input.activity) ? input.activity.flatMap((raw) => {
      if (!raw || typeof raw !== "object") return [];
      const item = raw as Record<string, unknown>;
      const id = clean(item.id, 80); const label = clean(item.label, 120); const at = clean(item.at, 40);
      return id && label && at ? [{ id, label, at }] : [];
    }).slice(0, 24) : []
  };
}
