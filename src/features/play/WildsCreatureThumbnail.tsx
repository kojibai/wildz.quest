"use client";

import { useMemo } from "react";
import { renderHeartboundSvg } from "./heartbound-renderer";
import type { PortableCardAsset } from "./portable-card";
import { projectWildsCardGenome } from "./wilds-card-artwork";

export function renderPortableCreatureThumbnail(asset: PortableCardAsset) {
  const genome = projectWildsCardGenome(asset);

  return renderHeartboundSvg(genome, "idle", {
    width: 180,
    height: 180,
    title: `${asset.manifest.name} deck portrait`,
    fit: "full-body"
  });
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
