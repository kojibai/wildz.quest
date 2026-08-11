"use client";

import { useEffect, useRef } from "react";
import { creatureForm } from "./creature-catalog";
import type { BattleAction, BattleState } from "./battle-engine";
import type { PortableCardAsset } from "./portable-card";

export function WildsBattle({
  battle,
  encounterPhase,
  inventory,
  onAction,
  onDismiss
}: {
  battle: BattleState;
  encounterPhase: string;
  inventory: PortableCardAsset[];
  onAction: (action: BattleAction) => void;
  onDismiss: () => void;
}) {
  const dialogRef = useRef<HTMLElement | null>(null);
  const dismissRef = useRef(onDismiss);
  dismissRef.current = onDismiss;
  const active = inventory.find((asset) => asset.id === battle.player.id);
  const form = active ? creatureForm(active.manifest.formId) : null;
  const ended = battle.phase === "fled" || battle.phase === "defeated";
  const message = battle.transcript.at(-1)?.detail ?? "A wild creature challenges your active card.";
  const effectiveness = battle.player.element === battle.wild.element ? "even" : `${battle.player.element} vs ${battle.wild.element}`;
  const battleInputEnabled = encounterPhase === "player_turn" || encounterPhase === "capture_ready";
  const captureTransitioning = !ended && !battleInputEnabled;

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    const focusable = () => Array.from(dialog.querySelectorAll<HTMLElement>(
      'button:not([disabled]), select:not([disabled]), [href], [tabindex]:not([tabindex="-1"])'
    ));
    const frame = window.requestAnimationFrame(() => (focusable()[0] ?? dialog).focus());
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        event.stopImmediatePropagation();
        if (ended) dismissRef.current();
        return;
      }
      if (event.key !== "Tab") return;
      const items = focusable();
      if (!items.length) { event.preventDefault(); dialog.focus(); return; }
      const first = items[0]!;
      const last = items[items.length - 1]!;
      if (event.shiftKey && (document.activeElement === first || !dialog.contains(document.activeElement))) { event.preventDefault(); last.focus(); }
      else if (!event.shiftKey && (document.activeElement === last || !dialog.contains(document.activeElement))) { event.preventDefault(); first.focus(); }
    };
    const containFocus = (event: FocusEvent) => {
      if (event.target instanceof Node && !dialog.contains(event.target)) (focusable()[0] ?? dialog).focus();
    };
    window.addEventListener("keydown", onKeyDown);
    document.addEventListener("focusin", containFocus);
    return () => {
      window.cancelAnimationFrame(frame);
      window.removeEventListener("keydown", onKeyDown);
      document.removeEventListener("focusin", containFocus);
    };
  }, [ended]);

  return (
    <section aria-labelledby="wilds-battle-title" aria-modal="true" className={`wilds-battle phase-${battle.phase}`} ref={dialogRef} role="dialog" tabIndex={-1}>
      <h2 className="sr-only" id="wilds-battle-title">Wild creature battle</h2>
      <div className="wilds-battle-turn"><span>Turn {battle.turn}</span><small>{battle.player.name} · Wild {battle.wild.name}</small></div>
      <div className="wilds-battle-console">
        <div className={`wilds-battle-intent intent-${battle.intent.kind}`} aria-label={`Wild intent: ${battle.intent.label}`}>
          <strong>{battle.intent.label}</strong><span>{battle.intent.detail}</span>
        </div>
        <p aria-live="polite">{message}</p>
        {battle.wild.conditions.length ? <div className="wilds-battle-conditions" aria-label="Wild creature conditions">
          {battle.wild.conditions.map((condition) => <span className="wilds-battle-condition" key={condition.kind}>{condition.kind.replace("_", " ")} · {condition.turns}</span>)}
        </div> : null}
        {ended ? (
          <button className="wilds-battle-primary" onClick={onDismiss} type="button">Return to discovery</button>
        ) : captureTransitioning ? (
          <div aria-live="assertive" className="wilds-battle-capture-transition" data-capture-phase={encounterPhase} role="status">
            <small>{encounterPhase === "battle_intro" ? "Encounter admission" : "Receiz capture sequence"}</small>
            <strong>{encounterPhase === "battle_intro" ? "Entering the encounter" : encounterPhase === "emerging" ? "Capture locked" : encounterPhase === "capsule" ? "Sealing portable card" : "Verifying captured companion"}</strong>
            <span>{encounterPhase === "battle_intro" ? "Reading the wild creature's intent…" : "Identity, stats, and custody are being sealed into the portable card."}</span>
            {encounterPhase !== "battle_intro" ? <div aria-label="Capture proof progress" className="wilds-battle-capture-progress">
              <i className="is-complete"><b>1</b><span>Locked</span></i>
              <i className={encounterPhase === "capsule" || encounterPhase === "sealed" ? "is-complete" : ""}><b>2</b><span>Sealed</span></i>
              <i className={encounterPhase === "sealed" ? "is-complete" : ""}><b>3</b><span>Verified</span></i>
            </div> : null}
          </div>
        ) : (
          <>
            <div className="wilds-battle-actions">
              <button disabled={battle.player.energy < 12} onClick={() => onAction({ type: "ability", slot: 0 })} type="button"><strong>{form?.abilities[0].name ?? "Pulse strike"}</strong><span>12 energy</span></button>
              <button disabled={battle.player.energy < 18} onClick={() => onAction({ type: "ability", slot: 1 })} type="button"><strong>{form?.abilities[1].name ?? "Bond burst"}</strong><span>18 energy</span></button>
              <button onClick={() => onAction({ type: "guard" })} type="button"><strong>Guard</strong><span>Recover energy</span></button>
              <button onClick={() => onAction({ type: "focus" })} type="button"><strong>Focus</strong><span>Read intent · {battle.player.focus}/3</span></button>
              <button
                aria-label="Capture weakened creature"
                className="wilds-battle-primary"
                disabled={battle.wild.hpRatio > 0.3}
                onClick={() => onAction({ type: "capture" })}
                type="button"
              ><strong>{battle.wild.hpRatio <= 0.3 ? "Capture now" : "Weaken to 30%"}</strong><span>Seal into capsule</span></button>
            </div>
            <div className="wilds-battle-meta">
              <span>{battle.player.energy}/50 energy · {battle.player.combo}x combo · {effectiveness}</span>
              <label>
                <span>Switch active card</span>
                <select
                  aria-label="Switch active card"
                  defaultValue=""
                  onChange={(event) => {
                    const asset = inventory.find((candidate) => candidate.id === event.target.value);
                    if (!asset) return;
                    onAction({ type: "switch", player: { assetId: asset.id, name: asset.manifest.name, element: creatureForm(asset.manifest.formId)?.element, ...asset.manifest.stats, health: asset.manifest.stats.health * 2 } });
                    event.currentTarget.value = "";
                  }}
                >
                  <option value="">Choose verified card…</option>
                  {inventory.filter((asset) => asset.id !== battle.player.id).map((asset) => <option key={asset.id} value={asset.id}>{asset.manifest.name} · Stage {asset.manifest.stage}</option>)}
                </select>
              </label>
            </div>
          </>
        )}
      </div>
    </section>
  );
}
