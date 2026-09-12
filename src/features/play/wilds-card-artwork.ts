import { deriveBirthGenome } from "./heartbound-genome";
import { renderHeartboundSvg } from "./heartbound-renderer";
import { currentLivingGenome } from "./living-card-proof";
import { isLivingCardAsset } from "./living-card-types";
import type { PortableCardAsset } from "./portable-card";

// Assets are immutable proof revisions. Cache by object so retired revisions can be collected.
const artwork = new WeakMap<PortableCardAsset, string>();
export function wildsCardArtwork(asset: PortableCardAsset) {
  const cached = artwork.get(asset);
  if (cached !== undefined) return cached;
  const svg = renderHeartboundSvg(
    isLivingCardAsset(asset) ? currentLivingGenome(asset) : deriveBirthGenome({
      formId: asset.manifest.formId, proofDigest: asset.proof.digest, variant: asset.manifest.variant.traits
    }),
    "card", { width: 640, height: 405, title: asset.manifest.name, fit: "full-body" }
  );
  artwork.set(asset, svg);
  return svg;
}
