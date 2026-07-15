"use client";

import type { PlayState, WildsInput } from "./game-state";
import { WildsCard } from "./WildsCard";

export function WildsChildCeremony({ state, onInput }: { state: PlayState; onInput: (input: WildsInput) => void }) {
  if (!state.lineageReveal) return null;
  const child = state.inventory.find((asset) => asset.id === state.lineageReveal?.childId);
  const parents = state.lineageReveal.parentIds.map((id) => state.inventory.find((asset) => asset.id === id)).filter(Boolean);
  if (!child) return null;
  return (
    <div className="wilds-ceremony-backdrop lineage" role="presentation">
      <section aria-label="Living child ceremony" aria-live="assertive" aria-modal="true" className="wilds-ceremony" role="dialog">
        <div className="wilds-ceremony-copy"><span>New independent living card</span><h2>{child.manifest.name} is born</h2><p>Traits from {parents.map((parent) => parent?.manifest.name).join(" + ")} formed a one-of-one genome and proof chain.</p><strong>Both parents remain yours.</strong></div>
        <WildsCard asset={child} />
        <button autoFocus className="button button-primary" onClick={() => onInput({ type: "finish-lineage-reveal" })} type="button">Welcome to the lineage</button>
      </section>
    </div>
  );
}
