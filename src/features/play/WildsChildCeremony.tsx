"use client";

import { useEffect, useState } from "react";
import type { PlayState, WildsInput } from "./game-state";
import { WildsCard } from "./WildsCard";

export function WildsChildCeremony({ state, onInput }: { state: PlayState; onInput: (input: WildsInput) => void }) {
  const [phase, setPhase] = useState<"forming" | "cracking" | "revealed">("forming");
  const revealId = state.lineageReveal?.eventId ?? null;
  useEffect(() => {
    if (!revealId) return;
    setPhase("forming");
    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const crackTimer = window.setTimeout(() => setPhase("cracking"), reducedMotion ? 40 : 620);
    const revealTimer = window.setTimeout(() => setPhase("revealed"), reducedMotion ? 90 : 1_480);
    return () => {
      window.clearTimeout(crackTimer);
      window.clearTimeout(revealTimer);
    };
  }, [revealId]);
  if (!state.lineageReveal) return null;
  const child = state.inventory.find((asset) => asset.id === state.lineageReveal?.childId);
  const parents = state.lineageReveal.parentIds.map((id) => state.inventory.find((asset) => asset.id === id)).filter(Boolean);
  if (!child) return null;
  return (
    <div className="wilds-ceremony-backdrop lineage" role="presentation">
      <section aria-label="Living child ceremony" aria-live="assertive" aria-modal="true" className={`wilds-ceremony is-${phase}`} role="dialog">
        <div className="wilds-ceremony-copy"><span>{phase === "revealed" ? "New independent living card" : "A new life is forming"}</span><h2>{phase === "revealed" ? `${child.manifest.name} is born` : phase === "cracking" ? "The shell is opening…" : "A living egg awakens"}</h2><p>Traits from {parents.map((parent) => parent?.manifest.name).join(" + ")} formed a one-of-one genome and proof chain.</p><strong>Both parents remain yours.</strong></div>
        <div className="wilds-hatch-stage" data-phase={phase} style={{ "--egg-primary": child.manifest.variant.traits.palette.primary, "--egg-accent": child.manifest.variant.traits.palette.accent, "--egg-glow": child.manifest.variant.traits.palette.glow } as React.CSSProperties}>
          <div aria-label={phase === "revealed" ? "Cracked lineage egg" : "Living lineage egg"} className="wilds-lineage-egg" role="img">
            <i className="wilds-egg-top" /><i className="wilds-egg-bottom" /><i className="wilds-egg-crack" />
          </div>
          <div className="wilds-hatched-card"><WildsCard asset={child} /></div>
        </div>
        {phase === "revealed" ? <button autoFocus className="button button-primary" onClick={() => onInput({ type: "finish-lineage-reveal" })} type="button">Welcome to the lineage</button> : <span className="wilds-hatch-status" role="status">{phase === "cracking" ? "The proof-sealed shell is cracking" : "The lineage spark is becoming visible"}</span>}
      </section>
    </div>
  );
}
