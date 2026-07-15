"use client";

import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { Icons } from "@/components/icons";
import { applyArenaIntent, createArenaMatch, type ArenaIntent } from "./arena-match";
import { applyHearttreeIntent, createHearttreeTrial, type HearttreeIntent } from "./hearttree-trial";
import type { PortableCardAsset } from "./portable-card";
import { applyPrismIntent, createPrismRun, type PrismIntent } from "./prism-run";
import type { WildsLandmarkAccess } from "./wilds-landmark-access";
import { WILDS_FLAGSHIP_LANDMARKS, type WildsLandmarkId } from "./wilds-landmarks";

function CardPin({ card, accent }: { card: PortableCardAsset | null; accent: string }) {
  return card ? (
    <div className="wilds-hearttree-card-pin" style={{ "--landmark-accent": accent } as React.CSSProperties}>
      <span style={{ background: card.manifest.variant.traits.palette.primary }}>{card.manifest.name.slice(0, 2).toUpperCase()}</span>
      <div><small>Verified companion</small><strong>{card.manifest.name}</strong><code>{card.proof.digest.slice(7, 19)}</code></div>
    </div>
  ) : <div className="wilds-hearttree-card-pin"><strong>A verified card is required</strong></div>;
}

export function WildsLandmarkExperience({ access, card, landmarkId, onExit, onUnlock }: { access: WildsLandmarkAccess | null; card: PortableCardAsset | null; landmarkId: WildsLandmarkId | null; onExit: () => void; onUnlock: (unlockId: string) => void }) {
  const landmark = WILDS_FLAGSHIP_LANDMARKS.find((item) => item.id === landmarkId) ?? null;
  const locked = Boolean(access && !access.allowed);
  const seed = useMemo(() => landmark && card ? `${landmark.id}:${card.proof.digest}` : "", [card, landmark]);
  const [hearttree, setHearttree] = useState(() => !locked && landmark?.id === "hearttree-sanctum" && card ? createHearttreeTrial(seed, card) : null);
  const [arena, setArena] = useState(() => !locked && landmark?.id === "arena-of-echoes" && card ? createArenaMatch(seed, card) : null);
  const [prism, setPrism] = useState(() => !locked && landmark?.id === "prism-arcade" && card ? createPrismRun(seed, card) : null);

  useEffect(() => {
    setHearttree(!locked && landmark?.id === "hearttree-sanctum" && card ? createHearttreeTrial(seed, card) : null);
    setArena(!locked && landmark?.id === "arena-of-echoes" && card ? createArenaMatch(seed, card) : null);
    setPrism(!locked && landmark?.id === "prism-arcade" && card ? createPrismRun(seed, card) : null);
  }, [card, landmark?.id, locked, seed]);

  const activePhase = hearttree?.phase ?? arena?.phase ?? prism?.phase;
  useEffect(() => {
    if (!landmark) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      if (activePhase && activePhase !== "result" && !window.confirm(`Leave the active ${landmark.name} experience?`)) return;
      onExit();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [activePhase, landmark, onExit]);

  if (!landmark || typeof document === "undefined") return null;
  const result = activePhase === "result";
  const hearttreeAct = (intent: HearttreeIntent) => setHearttree((current) => current ? applyHearttreeIntent(current, intent) : current);
  const arenaAct = (intent: ArenaIntent) => setArena((current) => current ? applyArenaIntent(current, intent) : current);
  const prismAct = (intent: PrismIntent) => setPrism((current) => current ? applyPrismIntent(current, intent) : current);
  const unlockId = hearttree?.reward?.unlockId ?? arena?.reward?.unlockId ?? prism?.reward?.unlockId ?? null;
  const finish = () => {
    if (unlockId) onUnlock(unlockId);
    onExit();
  };
  const gate = locked ? (
    <div className="wilds-landmark-gate" role="status">
      <Icons.lock aria-hidden="true" size={24} />
      <span>Discovered · entrance sealed</span>
      <strong>This place remembers your progress</strong>
      <p>{access?.summary}</p>
      <div>{access?.unmet.map((requirement) => <small key={`${requirement.kind}:${requirement.label}`}>{requirement.label}</small>)}</div>
    </div>
  ) : null;

  const world = landmark.id === "hearttree-sanctum" ? (
    <div className="wilds-landmark-world wilds-hearttree-world" aria-label="Hearttree trial chamber">
      <div className="wilds-hearttree-aurora" aria-hidden="true" /><div className="wilds-hearttree-trunk" aria-hidden="true"><i /><i /><i /></div><div className="wilds-hearttree-orbit" aria-hidden="true"><i /><i /><i /></div>
      {locked ? gate : <><div className="wilds-hearttree-status"><span>{result ? "Mastery sealed" : hearttree?.phase === "master" ? "Root Master encounter" : "Memory path"}</span><strong>{hearttree?.phase === "master" ? `Guard ${hearttree.guard}/3` : result ? hearttree?.reward?.label : hearttree?.chamberOrder[hearttree?.chamber ?? 0]}</strong><p aria-live="polite">{hearttree?.events.at(-1)?.message ?? "Pulse the sanctuary to reveal the memory path."}</p></div><CardPin accent={landmark.accent} card={card} /></>}
    </div>
  ) : landmark.id === "arena-of-echoes" ? (
    <div className="wilds-landmark-world wilds-arena-world" aria-label="Arena of Echoes duel">
      <div className="wilds-arena-crowd" aria-hidden="true"><i /><i /><i /><i /></div><div className="wilds-arena-ring" aria-hidden="true"><i /><i /><i /></div><div className="wilds-arena-rival" aria-hidden="true"><Icons.trophy size={38} /><b>{arena?.rivalHealth ?? 2}</b></div>
      {locked ? gate : <><div className="wilds-hearttree-status"><span>{result ? "Victory sealed" : "Live arena · ranked echo"}</span><strong>{result ? arena?.reward?.label : arena?.rivalName}</strong><p aria-live="polite">{arena?.events.at(-1)?.message ?? "Focus on the rival's rhythm, then answer the echo."}</p></div><div className="wilds-arena-score"><span>FOCUS {arena?.focus ?? 0}</span><strong>{arena?.streak ?? 0}×</strong><span>STREAK</span></div><CardPin accent={landmark.accent} card={card} /></>}
    </div>
  ) : (
    <div className="wilds-landmark-world wilds-prism-world" aria-label="Prism Arcade cooperative run">
      <div className="wilds-prism-sun" aria-hidden="true" /><div className="wilds-prism-track" aria-hidden="true"><i /><i /><i /><i /><i /></div><div className="wilds-prism-rider" aria-hidden="true"><Icons.game size={30} /></div>
      {locked ? gate : <><div className="wilds-hearttree-status"><span>{result ? "World complete" : prism?.phase === "run" ? "Co-op light run" : "Public sync portal"}</span><strong>{result ? prism?.reward?.label : prism?.worldName}</strong><p aria-live="polite">{prism?.events.at(-1)?.message ?? "Sync your verified card to open today's hidden world."}</p></div><div className="wilds-prism-harmony"><small>HARMONY</small><span>{[0, 1, 2, 3].map((step) => <i className={(prism?.harmony ?? 0) > step ? "is-lit" : ""} key={step} />)}</span></div><CardPin accent={landmark.accent} card={card} /></>}
    </div>
  );

  const actions = locked ? (
    <button className="wilds-landmark-primary" onClick={onExit} type="button"><Icons.globe aria-hidden="true" size={18} /><span><strong>Return to world</strong><small>The entrance stays marked on your map</small></span></button>
  ) : result ? (
    <button className="wilds-landmark-primary" onClick={finish} type="button"><Icons.globe aria-hidden="true" size={18} /><span><strong>Return to world</strong><small>Reward secured to this run</small></span></button>
  ) : landmark.id === "hearttree-sanctum" ? <>
    <button aria-label="Pulse memory" onClick={() => hearttreeAct("pulse")} type="button"><Icons.pulse size={18} /><span><strong>Pulse</strong><small>Reveal</small></span></button>
    <button aria-label="Advance through chamber" disabled={!hearttree?.clueRevealed} onClick={() => hearttreeAct("north")} type="button"><Icons.walk size={18} /><span><strong>Advance</strong><small>Follow clue</small></span></button>
    <button aria-label="Guard with active card" disabled={hearttree?.phase !== "master"} onClick={() => hearttreeAct("guard")} type="button"><Icons.seal size={18} /><span><strong>Guard</strong><small>Remember</small></span></button>
    <button aria-label="Use signature ability" disabled={hearttree?.phase !== "master" || hearttree.guard < 1} onClick={() => hearttreeAct("ability:0")} type="button"><Icons.sparkle size={18} /><span><strong>Awaken</strong><small>Signature</small></span></button>
  </> : landmark.id === "arena-of-echoes" ? <>
    <button aria-label="Focus on rival" onClick={() => arenaAct("focus")} type="button"><Icons.pulse size={18} /><span><strong>Focus</strong><small>Read echo</small></span></button>
    <button aria-label="Guard rival attack" disabled={!arena?.focus} onClick={() => arenaAct("guard")} type="button"><Icons.seal size={18} /><span><strong>Guard</strong><small>Build streak</small></span></button>
    <button aria-label="Strike rival" disabled={!arena?.focus} onClick={() => arenaAct("strike")} type="button"><Icons.trophy size={18} /><span><strong>Strike</strong><small>Seal victory</small></span></button>
  </> : <>
    <button aria-label="Sync cooperative run" onClick={() => prismAct("sync")} type="button"><Icons.users size={18} /><span><strong>Sync</strong><small>Join world</small></span></button>
    <button aria-label="Align cyan lane" disabled={prism?.phase !== "run"} onClick={() => prismAct("left")} type="button"><Icons.chevronLeft size={18} /><span><strong>Cyan</strong><small>Left lane</small></span></button>
    <button aria-label="Align magenta lane" disabled={prism?.phase !== "run"} onClick={() => prismAct("right")} type="button"><Icons.chevronRight size={18} /><span><strong>Magenta</strong><small>Right lane</small></span></button>
    <button aria-label="Release harmony burst" disabled={!prism?.leftGate || !prism.rightGate} onClick={() => prismAct("burst")} type="button"><Icons.sparkle size={18} /><span><strong>Burst</strong><small>Finish together</small></span></button>
  </>;

  return createPortal(
    <section aria-labelledby="wilds-landmark-title" aria-modal="true" className={`wilds-landmark-experience ${landmark.kind}`} role="dialog" style={{ "--landmark-accent": landmark.accent } as React.CSSProperties}>
      <header className="wilds-landmark-header"><div><span className="eyebrow">{locked ? "Discovered landmark · sealed" : `Enterable landmark · ${landmark.kind}`}</span><h2 id="wilds-landmark-title">{landmark.name}</h2></div><button aria-label="Return to world" onClick={onExit} type="button"><Icons.close aria-hidden="true" size={19} /></button></header>
      {world}<footer className="wilds-landmark-actions">{actions}</footer>
    </section>,
    document.body
  );
}
