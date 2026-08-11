"use client";

import { useEffect, useRef } from "react";
import { Icons } from "@/components/icons";
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
          <div aria-label={`${asset.manifest.name} sealed stats`} className="wilds-capture-seal-facts">
            <span><small>Health</small><strong>{asset.manifest.stats.health}</strong></span>
            <span><small>Power</small><strong>{asset.manifest.stats.power}</strong></span>
            <span><small>Guard</small><strong>{asset.manifest.stats.guard}</strong></span>
            <span><small>Speed</small><strong>{asset.manifest.stats.speed}</strong></span>
            <span><small>Bond</small><strong>{asset.manifest.stats.bond}</strong></span>
          </div>
          <button className="wilds-capture-action button button-primary" onClick={onClose} type="button"><Icons.collections aria-hidden="true" size={18} /><span>Open Card Vault</span><small>View sealed character</small></button>
        </div>
        <WildsCard asset={asset} />
      </section>
    </div>
  );
}
