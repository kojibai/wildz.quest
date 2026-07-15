"use client";

import { useMemo } from "react";
import { deriveBirthGenome } from "./heartbound-genome";
import { renderHeartboundSvg } from "./heartbound-renderer";
import { currentLivingGenome } from "./living-card-proof";
import { isLivingCardAsset } from "./living-card-types";
import type { PortableCardAsset } from "./portable-card";

export function renderPortableCreatureThumbnail(asset: PortableCardAsset) {
  const genome = isLivingCardAsset(asset)
    ? currentLivingGenome(asset)
    : deriveBirthGenome({
      formId: asset.manifest.formId,
      proofDigest: asset.proof.digest,
      variant: asset.manifest.variant.traits
    });

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
      dangerouslySetInnerHTML={{ __html: artwork }}
      style={{
        "--creature-primary": asset.manifest.variant.traits.palette.primary,
        "--creature-glow": asset.manifest.variant.traits.palette.glow
      } as React.CSSProperties}
    />
  );
}
