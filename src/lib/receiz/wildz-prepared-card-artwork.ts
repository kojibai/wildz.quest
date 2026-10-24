import "server-only";
import type { PortableCardAsset } from "../../features/play/portable-card";
import { renderWildsCardSvg } from "../../features/play/card-export";

// Share the small rendered front between the page and image route in the
// same server process. Full histories and ownership authority stay out.
const scope = globalThis as typeof globalThis & { __wildzPreparedCardArtworkV1?: Map<string, string> };
const artwork = scope.__wildzPreparedCardArtworkV1 ??= new Map<string, string>();
const key = (id: string, digest: string, origin: string) => JSON.stringify([id, digest, origin]);

export function preparedWildzCardArtwork(id: string, digest: string, origin: string) {
  const selected = key(id, digest, origin), svg = artwork.get(selected);
  if (svg) { artwork.delete(selected); artwork.set(selected, svg); }
  return svg ?? null;
}

/** Called only after the public page has verified this exact card. */
export function prepareVerifiedWildzCardArtwork(asset: PortableCardAsset, origin: string) {
  if (preparedWildzCardArtwork(asset.id, asset.proof.digest, origin)) return;
  artwork.set(key(asset.id, asset.proof.digest, origin), renderWildsCardSvg(asset, { origin }));
  while (artwork.size > 32) artwork.delete(artwork.keys().next().value!);
}
