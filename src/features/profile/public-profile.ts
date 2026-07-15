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
  const explorer = input.explorer && typeof input.explorer === "object" ? input.explorer as Record<string, unknown> : null;
  const safeExplorer: PublicWildzProfile["explorer"] = explorer && (explorer.gender === "female" || explorer.gender === "male") && explorer.traits && typeof explorer.digest === "string"
    ? { gender: explorer.gender as WildzCharacterGenesis["gender"], traits: explorer.traits as WildzCharacterGenesis["traits"], digest: clean(explorer.digest, 80) }
    : null;
  const record = input.record && typeof input.record === "object" ? input.record as Record<string, unknown> : {};

  return {
    schema: "wildz.public_profile.v1",
    username: clean(input.username, 48).replace(/^@?/, "@") || "@explorer",
    displayName: clean(input.displayName) || "Wildz Explorer",
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
