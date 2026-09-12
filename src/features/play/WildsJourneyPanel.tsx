"use client";

import type { WildsNextStep, WildsNextStepAction } from "./wilds-next-step";
import styles from "./WildsJourneyPanel.module.css";

export type WildsJourneyPanelMemory = Readonly<{
  id: string;
  kind: string;
  label: string;
  companionName?: string;
  position: Readonly<{ x: number; z: number }>;
  timestamp: number;
}>;

export type WildsJourneyPanelProps = Readonly<{
  step: WildsNextStep;
  companionName?: string;
  memories: readonly WildsJourneyPanelMemory[];
  home?: Readonly<{ label: string; distance: number }>;
  onAction: (action: WildsNextStepAction) => void;
  onReturnHome?: () => void;
  onRest?: () => void;
  canRest?: boolean;
}>;

export function WildsJourneyPanel({ step, companionName, memories, home, onAction, onReturnHome, onRest, canRest = false }: WildsJourneyPanelProps) {
  const recent = [...memories].sort((a, b) => b.timestamp - a.timestamp).slice(0, 5);
  return <section className={styles.journey} aria-label="Your shared journey">
    <span className={styles.eyebrow}>Your next adventure</span>
    <h3 className={styles.title}>{step.title}</h3>
    <p className={styles.reason}>{step.reason}</p>
    <button className={styles.primary} type="button" onClick={() => onAction(step.action)}>{step.actionLabel}<span aria-hidden="true">↗</span></button>

    {step.action !== "explore" && <div className={styles.actions}><button type="button" onClick={() => onAction("explore")}>Find a discovery instead</button></div>}

    {home && <section className={styles.home} aria-label="Your home">
      <div><span className={styles.eyebrow}>A place to return to</span><h4>{home.label}</h4>
        <p>{Number.isFinite(home.distance) ? `${Math.round(Math.max(0, home.distance))} m away` : "On your map"}{canRest ? " · Close enough to rest" : " · Rest when you arrive"}</p></div>
      <div className={styles.actions}>
        {onReturnHome && <button type="button" onClick={onReturnHome}>Find home</button>}
        {onRest && <button type="button" onClick={onRest} disabled={!canRest}>Rest together</button>}
      </div>
    </section>}

    <section className={styles.memories} aria-label="Shared memories">
      <span className={styles.eyebrow}>{companionName ? `On the trail with ${companionName}` : "Your trail journal"}</span>
      <h4>What you have shared</h4>
      <p className={styles.empty}>Explorer notes travel with your next saved Identity Seal.</p>
      {recent.length ? <ol>{recent.map((memory) => <li key={memory.id}>
        <span className={styles.marker} aria-hidden="true" />
        <div><p>{memory.label}</p>{memory.companionName && <span className={styles.with}>With {memory.companionName}</span>}<span className={styles.with}>X {Math.round(memory.position.x)} · Z {Math.round(memory.position.z)}</span></div>
      </li>)}</ol> : <p className={styles.empty}>Your shared story starts with what you do next. Discover a place, gather materials, or build together to remember it here.</p>}
    </section>
  </section>;
}
