"use client";

import type { PlayState, WildsInput } from "./game-state";
import { WildsCard } from "./WildsCard";

export function WildsTransformation({ state, onInput }: { state: PlayState; onInput: (input: WildsInput) => void }) {
  if (!state.transformation) return null;
  const asset = state.inventory.find((candidate) => candidate.id === state.transformation?.assetId);
  if (!asset) return null;
  return (
    <div className="wilds-ceremony-backdrop" role="presentation">
      <section aria-label="Living card transformation" aria-live="assertive" aria-modal="true" className="wilds-ceremony" role="dialog">
        <div className="wilds-ceremony-copy"><span>Proof history expanded</span><h2>{asset.manifest.name} transformed</h2><p>{state.transformation.reason}</p><strong>Revision {state.transformation.fromRevision} → {state.transformation.toRevision}</strong></div>
        <WildsCard asset={asset} />
        <button autoFocus className="button button-primary" onClick={() => onInput({ type: "finish-transformation" })} type="button">Continue the journey</button>
      </section>
    </div>
  );
}
