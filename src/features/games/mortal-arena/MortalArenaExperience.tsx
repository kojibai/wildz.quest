"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type PointerEvent as ReactPointerEvent } from "react";
import { createPortal } from "react-dom";
import { Icons } from "@/components/icons";
import { currentRevision } from "../../play/living-card-proof";
import { isLivingCardAsset } from "../../play/living-card-types";
import type { PortableCardAsset } from "../../play/portable-card";
import type { WildsAudioCue } from "../../play/wilds-audio";
import { selectWildsQualityProfile } from "../../play/wilds-quality-profile";
import type { WildzArenaPath } from "./campaign";
import { MORTAL_ARENA_COVENANT_VERSION, MortalArenaCovenant } from "./MortalArenaCovenant";
import { MortalArenaScene } from "./MortalArenaScene";
import type { ArenaSettlement } from "./settlement";
import { useMortalArena } from "./use-mortal-arena";

export function MortalArenaExperience({ card, roster, onExit, onUnlock, onCommit, onAudioCue }: {
  card: PortableCardAsset;
  roster: readonly PortableCardAsset[];
  onExit: () => void;
  onUnlock: (unlockId: string) => void;
  onCommit: (settlement: ArenaSettlement, path: WildzArenaPath) => void;
  onAudioCue?: (cue: WildsAudioCue) => void;
}) {
  const admittedRoster = useMemo(() => [card, ...roster.filter((item) => item.id !== card.id)].slice(0, 3), [card, roster]);
  const life = isLivingCardAsset(card) ? currentRevision(card).growth.life : null;
  const grave = Boolean(life && life.vitality / Math.max(1, life.maxVitality) <= .15);
  const retired = Boolean(life?.retired);
  const [covenantAccepted, setCovenantAccepted] = useState(() => typeof window !== "undefined" && !grave && window.localStorage.getItem(MORTAL_ARENA_COVENANT_VERSION) === "accepted");
  const qualityProfile = useMemo(() => selectWildsQualityProfile({
    width: typeof window === "undefined" ? 390 : window.innerWidth,
    hardwareConcurrency: typeof navigator === "undefined" ? 4 : navigator.hardwareConcurrency,
    deviceMemory: typeof navigator === "undefined" ? 4 : (navigator as Navigator & { deviceMemory?: number }).deviceMemory,
    reducedMotion: typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches
  }), []);
  const committed = useCallback((settlement: ArenaSettlement, path: WildzArenaPath) => {
    onCommit(settlement, path);
    if (settlement.result.winnerSide === 0) onUnlock(path.stage % 3 === 1 ? "echo-sovereign" : "echo-victor");
  }, [onCommit, onUnlock]);
  const arena = useMortalArena({ active: covenantAccepted && !retired, roster: admittedRoster, onCommit: committed });
  const player = arena.state.sides[0].fighters[arena.state.sides[0].activeIndex]!;
  const activeArenaCard = admittedRoster[arena.state.sides[0].activeIndex] ?? card;
  const rival = arena.state.sides[1].fighters[arena.state.sides[1].activeIndex]!;
  const lastImpact = useRef(0);
  const lastWarning = useRef(arena.warning);

  useEffect(() => {
    if (arena.impactTick > 0 && arena.impactTick !== lastImpact.current) {
      lastImpact.current = arena.impactTick;
      onAudioCue?.("battle-hit");
      if (typeof navigator !== "undefined" && "vibrate" in navigator) navigator.vibrate(24);
    }
  }, [arena.impactTick, onAudioCue]);

  useEffect(() => {
    if (arena.warning === lastWarning.current) return;
    lastWarning.current = arena.warning;
    if (arena.warning === "grave" || arena.warning === "final") {
      onAudioCue?.("error");
      if (typeof navigator !== "undefined" && "vibrate" in navigator) navigator.vibrate(arena.warning === "final" ? [60, 45, 90] : [35, 45, 35]);
    }
  }, [arena.warning, onAudioCue]);

  useEffect(() => {
    if (!arena.settlement) return;
    onAudioCue?.(arena.settlement.result.winnerSide === 0 ? "boss-defeat" : "boss-action");
  }, [arena.settlement, onAudioCue]);

  if (typeof document === "undefined") return null;
  const vitality = Math.round(player.vitality / Math.max(1, player.maxVitality) * 100);
  const rivalVitality = Math.round(rival.vitality / Math.max(1, rival.maxVitality) * 100);
  const resultLabel = arena.result?.winnerSide === 0 ? "Victory carried forward" : arena.result?.outcome === "fled" ? "Retreat survived" : "The Arena remembers";

  return createPortal(
    <section aria-labelledby="mortal-arena-title" aria-modal="true" className={`wilds-landmark-experience competition mortal-arena-experience warning-${arena.warning}`} role="dialog">
      <header className="wilds-landmark-header mortal-arena-header">
        <div><span className="eyebrow">Stage {arena.path.stage} · {arena.opponent.kind === "boss" ? "Sovereign encounter" : "Mortal match"}</span><h2 id="mortal-arena-title">Mortal Arena</h2></div>
        <button aria-label="Leave Mortal Arena" onClick={onExit} type="button"><Icons.close aria-hidden="true" size={19} /></button>
      </header>
      <div className="wilds-landmark-world wilds-arena-world mortal-arena-live-world">
        {!covenantAccepted && !retired ? <MortalArenaCovenant card={card} onConfirm={() => setCovenantAccepted(true)} onExit={onExit} /> : null}
        {retired ? <div className="mortal-arena-retired" role="status"><Icons.star size={38} /><span>Memorial seal</span><h3>{card.manifest.name} has completed their final chapter.</h3><p>Their card and full history remain in your Vault. They cannot enter another match.</p><button onClick={onExit} type="button">Return to the Wilds</button></div> : null}
        <MortalArenaScene state={arena.state} roster={admittedRoster} opponent={arena.opponent} qualityProfile={qualityProfile} impactTick={arena.impactTick} />
        <div className="mortal-arena-hud" aria-live="polite">
          <article className={`mortal-arena-life is-player is-${arena.warning}`}>
            <span><strong>{activeArenaCard.manifest.name}</strong><small>{arena.warning === "safe" ? `Reserve ${arena.state.sides[0].fighters.length}` : arena.warning}</small></span>
            <div aria-label={`${vitality}% Vitality`}><i style={{ width: `${vitality}%` }} /></div><b>{vitality}</b>
          </article>
          <div className="mortal-arena-round-mark" aria-hidden="true"><i /><strong>{arena.opponent.kind === "boss" ? arena.opponent.phases[Math.min(arena.opponent.phases.length - 1, Math.floor((100 - rivalVitality) / 34))] : "VS"}</strong><i /></div>
          <article className="mortal-arena-life is-rival">
            <span><strong>{arena.opponent.name}</strong><small>{arena.opponent.kind}</small></span>
            <div aria-label={`${rivalVitality}% rival Vitality`}><i style={{ width: `${rivalVitality}%` }} /></div><b>{rivalVitality}</b>
          </article>
        </div>
        {arena.warning !== "safe" ? <div className={`mortal-arena-warning is-${arena.warning}`} role="alert"><i /><Icons.pulse aria-hidden="true" size={19} /><span>{arena.warning === "final" ? "One more clean hit may be final" : arena.warning === "grave" ? "Swap or flee while life remains" : "Vitality strained"}</span><i /></div> : null}
        {arena.settlement ? <div className="mortal-arena-result" role="status"><Icons.trophy size={32} /><span>Result sealed locally</span><h3>{resultLabel}</h3><p>{`${arena.settlement.card.manifest.name}'s history has been appended before this result appeared.`}</p><button onClick={arena.continuePath} type="button">Continue to stage {arena.path.stage}</button><button onClick={onExit} type="button">Return to world</button></div> : null}
      </div>
      <footer className="wilds-landmark-actions mortal-arena-actions" aria-label="Mortal Arena actions">
        <button aria-label="Focus and read the rival" disabled={!covenantAccepted || retired || Boolean(arena.settlement)} onClick={() => arena.pulse({ focus: true })} type="button"><Icons.pulse size={18} /><span><strong>Focus</strong><small>Read</small></span></button>
        <button aria-label="Guard while held" disabled={!covenantAccepted || retired || Boolean(arena.settlement)} onPointerCancel={() => arena.hold("guard", false)} onPointerDown={() => arena.hold("guard", true)} onPointerLeave={() => arena.hold("guard", false)} onPointerUp={() => arena.hold("guard", false)} type="button"><Icons.seal size={18} /><span><strong>Guard</strong><small>Hold</small></span></button>
        <MortalArenaTrackpad disabled={!covenantAccepted || retired || Boolean(arena.settlement)} onJump={() => arena.pulse({ jump: true })} onMove={arena.setMovement} />
        <button aria-label="Strike rival" disabled={!covenantAccepted || retired || Boolean(arena.settlement)} onClick={() => arena.pulse({ light: true })} type="button"><Icons.trophy size={18} /><span><strong>Strike</strong><small>Attack</small></span></button>
        <button aria-label="Swap to the next living reserve" disabled={!covenantAccepted || retired || Boolean(arena.settlement) || arena.state.sides[0].fighters.length < 2} onClick={() => arena.pulse({ swapTo: (arena.state.sides[0].activeIndex + 1) % arena.state.sides[0].fighters.length })} type="button"><Icons.users size={18} /><span><strong>Swap</strong><small>Reserve</small></span></button>
        <button className="mortal-arena-flee" aria-label="Flee while held" disabled={!covenantAccepted || retired || Boolean(arena.settlement)} onPointerCancel={() => arena.hold("flee", false)} onPointerDown={() => arena.hold("flee", true)} onPointerLeave={() => arena.hold("flee", false)} onPointerUp={() => arena.hold("flee", false)} type="button"><Icons.door size={18} /><span><strong>Flee</strong><small>Hold</small></span></button>
      </footer>
    </section>,
    document.body
  );
}

export function MortalArenaTrackpad({ disabled, onMove, onJump }: {
  disabled: boolean;
  onMove: (x: number, z: number) => void;
  onJump: () => void;
}) {
  const [knob, setKnob] = useState({ x: 0, y: 0 });
  const activeRef = useRef(false);
  const movedRef = useRef(false);
  const update = (event: ReactPointerEvent<HTMLButtonElement>) => {
    const rect = event.currentTarget.getBoundingClientRect();
    const radius = Math.max(1, Math.min(rect.width, rect.height) * .34);
    const rawX = event.clientX - rect.left - rect.width / 2;
    const rawY = event.clientY - rect.top - rect.height / 2;
    const magnitude = Math.hypot(rawX, rawY);
    if (magnitude > 4) movedRef.current = true;
    const scale = magnitude > radius ? radius / magnitude : 1;
    const x = rawX * scale;
    const y = rawY * scale;
    setKnob({ x, y });
    onMove(x / radius, y / radius);
  };
  const release = () => { activeRef.current = false; setKnob({ x: 0, y: 0 }); onMove(0, 0); };
  return <button
    aria-label="Arena movement trackpad. Hold and drag to move freely. Tap the center to jump."
    className="mortal-arena-trackpad"
    disabled={disabled}
    onClick={(event) => { if (!movedRef.current) onJump(); event.preventDefault(); }}
    onPointerCancel={release}
    onPointerDown={(event) => { activeRef.current = true; movedRef.current = false; event.currentTarget.setPointerCapture?.(event.pointerId); update(event); }}
    onPointerMove={(event) => { if (activeRef.current) update(event); }}
    onPointerUp={release}
    type="button"
  ><span className="mortal-arena-trackpad-ring" /><i><Icons.chevronUp aria-hidden="true" size={15} /></i><b style={{ transform: `translate(${knob.x}px, ${knob.y}px)` }} /></button>;
}
