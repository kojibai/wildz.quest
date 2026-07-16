import catalog from "../../../public/audio/wildz/catalog.json" with { type: "json" };

export type WildsAudioAsset = {
  id: string;
  kind: "music" | "ambience" | "effect" | "signature";
  path: `/audio/wildz/${string}`;
  sourcePage: string;
  license: "CC0-1.0" | "Public-Domain" | "Receiz-Owned";
  licenseUrl: string;
  sha256: string;
  loop: boolean;
  roles: readonly string[];
};

export function assertCommercialAudioCatalog(items: readonly WildsAudioAsset[]): void {
  const ids = new Set<string>();
  for (const item of items) {
    if (ids.has(item.id)) throw new Error(`Duplicate audio id: ${item.id}`);
    ids.add(item.id);
    if (!/^(CC0-1.0|Public-Domain|Receiz-Owned)$/.test(item.license)) throw new Error(`Blocked license: ${item.id}`);
    if (!item.path.startsWith("/audio/wildz/") || item.path.includes("..") || /^https?:/i.test(item.path)) {
      throw new Error(`Local audio path required: ${item.id}`);
    }
    if (!/^[a-f0-9]{64}$/.test(item.sha256)) throw new Error(`Missing digest: ${item.id}`);
    if (!item.roles.length) throw new Error(`Missing runtime role: ${item.id}`);
    if (item.license !== "Receiz-Owned" && item.licenseUrl !== "https://creativecommons.org/publicdomain/zero/1.0/") {
      throw new Error(`Blocked license deed: ${item.id}`);
    }
  }
}

export const WILDS_AUDIO_ASSETS = Object.freeze(catalog as unknown as readonly WildsAudioAsset[]);
assertCommercialAudioCatalog(WILDS_AUDIO_ASSETS);

export const WILDS_AUDIO_BY_ID = new Map(WILDS_AUDIO_ASSETS.map((asset) => [asset.id, asset] as const));
