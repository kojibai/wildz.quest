"use client";

import { useEffect, useId, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { canRestoreFocus } from "./focus-recovery";
import type { WildsRoamingBattle as RoamingBattle, WildsRoamingBattleIntent } from "./wilds-roaming-battle";
import styles from "./WildsRoamingBattle.module.css";

export type WildsRoamingBattleProps = {
  open: boolean;
  session: RoamingBattle | null;
  pending: boolean;
  captureRestored?: boolean;
  error: string;
  phase: "waiting" | "battle" | "offered" | "captured" | "ended";
  onIntent: (intent: WildsRoamingBattleIntent) => void;
  onClaim: () => void;
  onClose: () => void;
};

export function WildsRoamingBattle(props: WildsRoamingBattleProps) {
  const { open, session, pending, error, phase, captureRestored, onIntent, onClaim, onClose } = props;
  const titleId = useId();
  const statusId = useId();
  const dialogRef = useRef<HTMLElement>(null);
  const propsRef = useRef(props);
  propsRef.current = props;
  const actionLocked = useRef(false);
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  useEffect(() => { actionLocked.current = pending; }, [pending, session?.revision, session?.sessionId, phase, error, open]);

  const submit = (action: () => void) => {
    if (propsRef.current.pending || actionLocked.current) return;
    actionLocked.current = true;
    action();
  };

  useEffect(() => {
    if (!open || !mounted) return;
    const dialog = dialogRef.current;
    if (!dialog) return;
    const origin = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const focusable = () => Array.from(dialog.querySelectorAll<HTMLElement>(
      'button:not(:disabled), summary, [href], [tabindex]:not([tabindex="-1"])'
    )).filter((item) => !item.hidden && item.getClientRects().length > 0);
    const frame = window.requestAnimationFrame(() => (focusable()[0] ?? dialog).focus());
    const keydown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        event.stopImmediatePropagation();
        const current = propsRef.current;
        if (current.pending || actionLocked.current) return;
        if (current.phase === "battle" && current.session?.outcome === "active") {
          submit(() => current.onIntent({ type: "retreat" }));
        } else current.onClose();
        return;
      }
      if (event.key !== "Tab") return;
      const items = focusable();
      const first = items[0] ?? dialog;
      const last = items.at(-1) ?? dialog;
      if (!items.length || (event.shiftKey && (document.activeElement === first || !dialog.contains(document.activeElement)))) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && (document.activeElement === last || !dialog.contains(document.activeElement))) {
        event.preventDefault();
        first.focus();
      }
    };
    const contain = (event: FocusEvent) => {
      if (event.target instanceof Node && !dialog.contains(event.target)) (focusable()[0] ?? dialog).focus();
    };
    window.addEventListener("keydown", keydown, true);
    document.addEventListener("focusin", contain);
    return () => {
      window.cancelAnimationFrame(frame);
      window.removeEventListener("keydown", keydown, true);
      document.removeEventListener("focusin", contain);
      if (canRestoreFocus(origin)) origin.focus();
    };
  }, [open, mounted]);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (open && dialog && !dialog.contains(document.activeElement)) dialog.focus();
  }, [open, phase, pending]);

  if (!open || !mounted) return null;
  const challenger = session?.battle.players[session.challengerId];
  const defender = session?.battle.players[session.defenderId];
  const active = phase === "battle" && session?.outcome === "active";
  const offered = phase === "offered" && session?.outcome === "capture-eligible";
  const status = phase === "waiting" ? session?.outcome === "capture-eligible" ? "Victory! Waiting for the creature’s owner to verify the result and prepare capture…" : "Waiting for the roaming creature…"
    : phase === "captured" ? captureRestored ? "Capture confirmed. This creature has joined your collection." : "Capture confirmed. Restore this creature into your collection."
    : offered ? "Victory! The creature can now be captured."
    : active ? pending ? "Resolving the turn…" : "Choose your move. The roaming creature fights for itself."
    : session?.outcome === "defended" ? "The roaming creature won and remains with its owner."
    : session?.outcome === "retreated" ? "You retreated. The creature remains with its owner."
    : session?.outcome === "timed-out" ? "The encounter expired. The creature remains with its owner."
    : session?.outcome === "draw" ? "A draw. The creature remains with its owner."
    : "The encounter has ended.";

  return createPortal(<div className={styles.backdrop}>
    <section className={styles.dialog} ref={dialogRef} role="dialog" aria-modal="true" aria-labelledby={titleId} aria-describedby={statusId} aria-busy={pending} tabIndex={-1}>
      <header className={styles.header}><span>ROAMING ENCOUNTER</span><h2 id={titleId}>{active ? `Turn ${session.battle.turn}` : phase === "captured" ? "Creature captured" : offered ? "Victory" : "Roaming battle"}</h2></header>
      {challenger && defender ? <div className={styles.fighters}>{[challenger, defender].map((fighter, index) => <div className={styles.fighter} key={fighter.playerId}>
        <span>{index === 0 ? "YOUR CREATURE" : "ROAMING DEFENDER"}</span><strong>{fighter.card.name}</strong>
        <div className={styles.health} role="progressbar" aria-label={`${fighter.card.name} health`} aria-valuemin={0} aria-valuemax={fighter.maxHp} aria-valuenow={fighter.hp}><i style={{ width: `${Math.max(0, Math.min(100, fighter.hp / Math.max(1, fighter.maxHp) * 100))}%` }} /></div>
        <small>{fighter.hp}/{fighter.maxHp} HP</small>
      </div>)}</div> : null}
      <p id={statusId} role="status" aria-live="polite">{status}</p>
      {error ? <p className={styles.error} role="alert">{error}</p> : null}
      {session?.battle.transcript.length ? <details className={styles.transcript} open><summary>Battle history</summary><ol tabIndex={0} aria-label="Battle turns">{session.battle.transcript.map((turn) => <li key={turn.turn}><strong>Turn {turn.turn}</strong>{turn.actions.map((action, index) => <p key={`${action.playerId}:${index}`}>{session.battle.players[action.playerId]?.card.name ?? "Creature"}: {action.detail}</p>)}</li>)}</ol></details> : null}
      {active && challenger ? <div className={styles.actions}>
        {challenger.card.abilities.map((ability, slot) => <button disabled={pending} key={slot} onClick={() => submit(() => onIntent({ type: "ability", slot: slot as 0 | 1 }))} type="button"><strong>{ability.name}</strong><small>{ability.power} power</small></button>)}
        <button disabled={pending} onClick={() => submit(() => onIntent({ type: "guard" }))} type="button"><strong>Guard</strong><small>Reduce incoming damage</small></button>
        <button disabled={pending} onClick={() => submit(() => onIntent({ type: "retreat" }))} type="button"><strong>Retreat</strong><small>Leave the creature with its owner</small></button>
      </div> : <div className={styles.actions}>
        {phase === "captured" && !captureRestored ? <button className={styles.primary} disabled={pending} onClick={() => submit(onClaim)} type="button">Restore captured creature</button> : null}
        {offered ? <button className={styles.primary} disabled={pending} onClick={() => submit(onClaim)} type="button">{pending ? "Confirming capture…" : "Capture creature"}</button> : null}
        <button disabled={pending} onClick={onClose} type="button">{phase === "waiting" && !session ? "Cancel encounter" : "Return to world"}</button>
      </div>}
    </section>
  </div>, document.body);
}
