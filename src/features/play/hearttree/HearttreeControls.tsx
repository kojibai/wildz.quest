"use client";

import { useCallback, useEffect, useRef, type PointerEvent as ReactPointerEvent } from "react";
import type { PortableCardAsset } from "../portable-card";
import { hearttreeAbilitiesFor } from "./ability-registry";
import type { HearttreeCardCapability } from "./card-capability";
import type { HearttreeInput, HearttreeRuntimeState } from "./runtime";

type InputIntent = HearttreeInput extends infer Value ? Value extends HearttreeInput ? Omit<Value, "sequence" | "tick"> : never : never;

export function HearttreeControls({ cards, onIntent, runtime, squad }: { cards: readonly PortableCardAsset[]; onIntent: (intent: InputIntent) => void; runtime: HearttreeRuntimeState; squad: readonly HearttreeCardCapability[] }) {
  const repeatRef = useRef<number | null>(null);
  const active = runtime.cards[runtime.activeAssetId]!;
  const capability = squad.find((card) => card.assetId === runtime.activeAssetId)!;
  const abilities = hearttreeAbilitiesFor(capability);

  const stopMove = useCallback(() => {
    if (repeatRef.current !== null) window.clearInterval(repeatRef.current);
    repeatRef.current = null;
  }, []);
  const startMove = useCallback((event: ReactPointerEvent<HTMLButtonElement>, vector: { x: number; z: number }) => {
    event.preventDefault();
    event.currentTarget.setPointerCapture(event.pointerId);
    stopMove();
    onIntent({ kind: "move", vector });
    repeatRef.current = window.setInterval(() => onIntent({ kind: "move", vector }), 90);
  }, [onIntent, stopMove]);
  useEffect(() => {
    window.addEventListener("blur", stopMove);
    return () => {
      window.removeEventListener("blur", stopMove);
      stopMove();
    };
  }, [stopMove]);

  const moveButton = (label: string, className: string, glyph: string, vector: { x: number; z: number }) => (
    <button
      aria-label={label}
      className={`hearttree-touch-control ${className}`}
      onPointerCancel={stopMove}
      onPointerDown={(event) => startMove(event, vector)}
      onPointerUp={stopMove}
      type="button"
    >{glyph}</button>
  );
  return <div className="hearttree-controls" aria-label="Hearttree controls">
    <div className="hearttree-move-pad" aria-label="Movement">
      {moveButton("Move north", "north", "↑", { x: 0, z: -1 })}
      {moveButton("Move west", "west", "←", { x: -1, z: 0 })}
      {moveButton("Move east", "east", "→", { x: 1, z: 0 })}
      {moveButton("Move south", "south", "↓", { x: 0, z: 1 })}
    </div>
    <div className="hearttree-action-wheel">
      <button className="hearttree-touch-control" onClick={() => onIntent({ kind: "dodge", vector: { x: 1, z: 0 }, timingOffsetMs: 0 })}><strong>Dodge</strong><small>{active.stamina} stamina</small></button>
      <button className="hearttree-touch-control" onClick={() => onIntent({ kind: "guard", timingOffsetMs: 0 })}><strong>Guard</strong><small>{active.health}/{active.maxHealth} health</small></button>
      {abilities.map((ability) => <button className="hearttree-touch-control" disabled={(active.cooldowns[ability.id] ?? 0) > runtime.tick} key={ability.id} onClick={() => onIntent({ kind: "ability", abilityId: ability.id, timingOffsetMs: 0 })}><strong>{ability.sourceName}</strong><small>{(active.cooldowns[ability.id] ?? 0) > runtime.tick ? "cooldowns active" : `${ability.power} power`}</small></button>)}
      <button className="hearttree-touch-control" onClick={() => onIntent({ kind: "interact" })}><strong>Attune</strong><small>Objective</small></button>
      <button className="hearttree-touch-control extract" onClick={() => onIntent({ kind: "extract" })}><strong>Extract</strong><small>Keep survival rewards</small></button>
    </div>
    {cards.length > 1 ? <div className="hearttree-switcher" aria-label="Switch active card">{cards.map((card) => <button className="hearttree-touch-control" disabled={card.id === runtime.activeAssetId} key={card.id} onClick={() => onIntent({ kind: "switch", assetId: card.id, tactical: runtime.threatActive })}>{card.manifest.name}</button>)}</div> : null}
  </div>;
}
