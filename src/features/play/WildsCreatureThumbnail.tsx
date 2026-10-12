"use client";

import { useMemo } from "react";
import {renderWildsCollectibleArt} from "./wilds-collectible-art";
import type { PortableCardAsset } from "./portable-card";

export function renderPortableCreatureThumbnail(asset: PortableCardAsset) {
  return renderWildsCollectibleArt(asset,{width:180,height:180,pose:"idle",habitat:false});
}

export function WildsCreatureThumbnail({ asset, className = "" }: { asset: PortableCardAsset; className?: string }) {
  const artwork = useMemo(() => renderPortableCreatureThumbnail(asset), [asset]);

  return (
    <span
      aria-hidden="true"
      className={`wilds-creature-thumbnail${className ? ` ${className}` : ""}`}
      style={{
        "--creature-primary": asset.manifest.variant.traits.palette.primary,
        "--creature-glow": asset.manifest.variant.traits.palette.glow
      } as React.CSSProperties}
    >
      <span className="wilds-creature-artwork" dangerouslySetInnerHTML={{ __html: artwork }} />
    </span>
  );
}
