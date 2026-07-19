"use client";

import { useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { Icons } from "@/components/icons";
import type { PortableCardAsset } from "../portable-card";
import { emptyHearttreeCondition, type HearttreeCardCondition } from "./card-capability";
import type { HearttreeMortalConsent } from "./consequences";
import type { HearttreeReceipt } from "./receipt";
import { HearttreeControls } from "./HearttreeControls";
import { HearttreeScene } from "./HearttreeScene";
import { useHearttreeExpedition } from "./use-hearttree-expedition";

type WorldMode = "receiz_live" | "kai_live" | "local_practice" | "connecting";

export function HearttreeRuntimeExperience({ cards, conditions, guestId, initialSquadAssetIds, onExit, onReceipt, onSquadChange, onUnlock, worldMode }: {
  cards: readonly PortableCardAsset[];
  conditions: Readonly<Record<string, HearttreeCardCondition>>;
  guestId: string;
  initialSquadAssetIds: readonly string[];
  onExit: () => void;
  onReceipt: (receipt: HearttreeReceipt) => void;
  onSquadChange: (assetIds: string[]) => void;
  onUnlock: (unlockId: string) => void;
  worldMode: WorldMode;
}) {
  const expedition = useHearttreeExpedition({ cards, conditions, initialSquadAssetIds, onSquadChange });
  const [publishing, setPublishing] = useState(false);
  const [publication, setPublication] = useState<"idle" | "canonical" | "practice" | "failed">("idle");
  const reducedMotion = useMemo(() => typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches, []);
  const active = expedition.runtime?.cards[expedition.runtime.activeAssetId];

  const publish = async () => {
    if (!expedition.runtime || !expedition.definition || !expedition.transcript || publishing) return;
    setPublishing(true);
    try {
      const mortalConsent: HearttreeMortalConsent | null = expedition.mortal ? {
        schema: "receiz.wilds.hearttree_mortal_consent.v1",
        expeditionId: expedition.definition.id,
        accepted: true,
        consequence: "permanent-death",
        squadPins: expedition.definition.squadPins,
        acceptedAt: new Date().toISOString()
      } : null;
      const response = await fetch("/api/wilds/hearttree", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          guestId,
          idempotencyKey: `hearttree-${expedition.transcript.digest.slice(7, 31)}`,
          cards: expedition.selectedCards,
          priorConditions: Object.fromEntries(expedition.selectedCards.map((card) => [card.id, conditions[card.id] ?? emptyHearttreeCondition(card.id)])),
          definition: expedition.definition,
          transcript: expedition.transcript,
          mortalConsent
        })
      });
      const result = await response.json();
      if (!response.ok || !result.ok) throw new Error(result.error ?? "hearttree_publication_failed");
      if (result.receipt) {
        onReceipt(result.receipt as HearttreeReceipt);
        setPublication("canonical");
      } else {
        setPublication("practice");
      }
      if (expedition.runtime.terminalReason === "completed") onUnlock("hearttree-awakened");
      expedition.setCaption(result.receipt ? "Canonical receipt adopted. Every verified consequence is permanent." : "Practice replay verified. No persistent consequence was adopted.");
    } catch {
      setPublication("failed");
      expedition.setCaption("Publication failed. No reward, injury, upgrade, or death was adopted.");
    } finally {
      setPublishing(false);
    }
  };

  if (typeof document === "undefined") return null;
  return createPortal(
    <section aria-labelledby="hearttree-runtime-title" aria-modal="true" className="wilds-landmark-experience sanctuary hearttree-expedition" role="dialog">
      <header className="wilds-landmark-header">
        <div><span className="eyebrow">{expedition.runtime ? `${expedition.runtime.phase} · chamber ${expedition.runtime.chamberIndex + 1}/4` : "Proof-pinned expedition"}</span><h2 id="hearttree-runtime-title">Hearttree Sanctum</h2></div>
        <button aria-label="Return to world" onClick={onExit} type="button"><Icons.close aria-hidden="true" size={19} /></button>
      </header>

      <div className="wilds-landmark-world wilds-hearttree-world hearttree-runtime-world">
        {!expedition.runtime || !expedition.definition ? <div className="hearttree-squad-gate">
          <div className="wilds-hearttree-aurora" aria-hidden="true" /><div className="wilds-hearttree-trunk" aria-hidden="true"><i /><i /><i /></div>
          <div className="hearttree-squad-list" aria-label="Hearttree squad">
            {expedition.available.map((card) => {
              const selected = expedition.selectedIds.includes(card.id);
              return <button aria-pressed={selected} className={selected ? "is-selected" : ""} key={card.id} onClick={() => expedition.toggleCard(card.id)} type="button">
                <span style={{ background: card.manifest.variant.traits.palette.primary }}>{card.manifest.name.slice(0, 2).toUpperCase()}</span>
                <div><strong>{card.manifest.name}</strong><small>{card.manifest.abilityNames.join(" · ")}</small><code>{card.proof.digest.slice(7, 19)}</code></div>
                <b>{card.manifest.stats.power} PWR</b>
              </button>;
            })}
          </div>
          <div className="hearttree-risk-panel">
            <label><input checked={expedition.mortal} onChange={(event) => expedition.setMortal(event.target.checked)} type="checkbox" /> Enter the optional Mortal Heart</label>
            {expedition.mortal ? <label className="is-mortal"><input checked={expedition.mortalAcknowledged} onChange={(event) => expedition.setMortalAcknowledged(event.target.checked)} type="checkbox" /> I understand permanent-death is irreversible for {expedition.selectedCards.map((card) => card.manifest.name).join(", ")}.</label> : <p>Standard expeditions can injure cards, but cannot kill them.</p>}
          </div>
        </div> : <>
          <HearttreeScene cards={expedition.selectedCards} definition={expedition.definition} reducedMotion={reducedMotion} runtime={expedition.runtime} />
          <div className="hearttree-hud">
            <div className="hearttree-objective"><small>{expedition.runtime.phase}</small><strong>{expedition.definition.chambers[expedition.runtime.chamberIndex]?.name ?? "Expedition result"}</strong><span>{expedition.runtime.objective.complete ? "Objective complete" : "Reach and attune the living objective"}</span></div>
            {active ? <div className="hearttree-vitals"><span><i style={{ width: `${active.health / active.maxHealth * 100}%` }} />Health {active.health}/{active.maxHealth}</span><span><i style={{ width: `${active.stamina}%` }} />Stamina {active.stamina}</span></div> : null}
            <button aria-label={expedition.paused ? "Resume expedition" : "Pause expedition"} className="hearttree-pause" onClick={() => expedition.setPaused(!expedition.paused)} type="button">{expedition.paused ? "▶" : "Ⅱ"}</button>
          </div>
        </>}
        <p aria-live="polite" className="hearttree-caption">{expedition.caption}</p>
        {expedition.paused ? <div className="hearttree-overlay"><strong>Expedition paused</strong><button onClick={() => expedition.setPaused(false)} type="button">Resume</button><button onClick={onExit} type="button">Return to world</button></div> : null}
        {expedition.terminal && expedition.runtime ? <div className="hearttree-overlay result"><small>{expedition.runtime.terminalReason}</small><strong>{expedition.runtime.phase === "defeated" ? "The squad fell" : expedition.runtime.phase === "extracted" ? "Extraction secured" : "The Heart remembers"}</strong><p>{publication === "canonical" ? "Canonical receipt adopted." : publication === "practice" ? "Practice result—no persistent consequences." : "Result awaits authoritative replay."}</p><button disabled={publishing || publication === "canonical" || publication === "practice"} onClick={() => void publish()} type="button">{publishing ? "Replaying…" : worldMode === "receiz_live" ? "Verify and seal result" : "Verify practice replay"}</button><button onClick={onExit} type="button">Return to world</button></div> : null}
      </div>

      <footer className="wilds-landmark-actions hearttree-runtime-actions">
        {!expedition.runtime ? <button className="wilds-landmark-primary" disabled={!expedition.selectedIds.length || (expedition.mortal && !expedition.mortalAcknowledged)} onClick={expedition.begin} type="button"><Icons.sparkle size={18} /><span><strong>Enter Hearttree</strong><small>{expedition.selectedIds.length}/3 living cards</small></span></button>
          : !expedition.terminal && !expedition.paused ? <HearttreeControls cards={expedition.selectedCards} onIntent={expedition.onIntent} runtime={expedition.runtime} squad={expedition.squad} /> : null}
      </footer>
    </section>,
    document.body
  );
}
