import type {PortableCardAsset} from "./portable-card";
import {renderWildsCollectibleArt} from "./wilds-collectible-art";

// Assets are immutable proof revisions. Cache by object so retired revisions can be collected.
const artwork = new WeakMap<PortableCardAsset, string>();
export function wildsCardArtwork(asset: PortableCardAsset) {
  const cached = artwork.get(asset);
  if (cached !== undefined) return cached;
  const svg = renderWildsCollectibleArt(asset,{width:640,height:405});
  artwork.set(asset, svg);
  return svg;
}
