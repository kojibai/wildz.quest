"use client";

import { creatureForm } from "./creature-catalog";
import type { BattleAction, BattleState } from "./battle-engine";
import type { PortableCardAsset } from "./portable-card";

function HealthBar({ label, hp, maxHp }: { label: string; hp: number; maxHp: number }) {
  const percent = Math.max(0, Math.min(100, Math.round((hp / maxHp) * 100)));
  return (
    <div className="wilds-battle-fighter">
      <div><strong>{label}</strong><span>{hp}/{maxHp} HP</span></div>
      <div className="wilds-battle-health" role="progressbar" aria-label={`${label} health`} aria-valuemin={0} aria-valuemax={maxHp} aria-valuenow={hp}><i style={{ width: `${percent}%` }} /></div>
    </div>
  );
}

export function WildsBattle({
  battle,
  inventory,
  onAction,
  onDismiss
}: {
  battle: BattleState;
  inventory: PortableCardAsset[];
  onAction: (action: BattleAction) => void;
  onDismiss: () => void;
}) {
  const active = inventory.find((asset) => asset.id === battle.player.id);
  const form = active ? creatureForm(active.manifest.formId) : null;
  const ended = battle.phase === "fled" || battle.phase === "defeated";
  const message = battle.transcript.at(-1)?.detail ?? "A wild creature challenges your active card.";
  const effectiveness = battle.player.element === battle.wild.element ? "even" : `${battle.player.element} vs ${battle.wild.element}`;

  return (
    <section className={`wilds-battle phase-${battle.phase}`} aria-label="Wild creature battle">
      <div className="wilds-battle-versus">
        <HealthBar label={battle.player.name} hp={battle.player.hp} maxHp={battle.player.maxHp} />
        <span>TURN {battle.turn}</span>
        <HealthBar label={`Wild ${battle.wild.name}`} hp={battle.wild.hp} maxHp={battle.wild.maxHp} />
      </div>
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
