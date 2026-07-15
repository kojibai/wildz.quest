"use client";

import { useEffect, useRef } from "react";
import type { PortableCardAsset } from "./portable-card";
import { WildsCard } from "./WildsCard";

export function WildsCaptureReward({ asset, onClose }: { asset: PortableCardAsset | null; onClose: () => void }) {
  const titleRef = useRef<HTMLHeadingElement>(null);
  useEffect(() => {
    if (asset) titleRef.current?.focus();
  }, [asset]);
  if (!asset) return null;
  return (
    <div className="wilds-capture-backdrop" role="presentation">
      <section aria-describedby="wilds-capture-status" aria-labelledby="wilds-capture-title" aria-modal="true" className="wilds-capture-dialog" role="dialog">
        <div className="wilds-capture-showcase">
          <div className="wilds-capture-stage" aria-hidden="true">
            <div className="wilds-capture-rays" />
            <div className="wilds-capture-capsule"><span /><i /></div>
            <div className="wilds-capture-proof-ring" />
          </div>
          <div className="wilds-capture-copy" aria-live="assertive">
            <span>Creature collected · proof sealed</span>
            <h2 id="wilds-capture-title" ref={titleRef} tabIndex={-1}>{asset.manifest.name} joined your Wilds</h2>
            <p id="wilds-capture-status">Portable, verified, and ready in your inventory.</p>
          </div>
          <button className="button button-primary" onClick={onClose} type="button">Open inventory</button>
        </div>
        <WildsCard asset={asset} />
      </section>
    </div>
  );
}
