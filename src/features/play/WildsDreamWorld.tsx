"use client";

import { useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import { Icons } from "@/components/icons";
import { KAI_PULSE_DURATION_MS } from "./kai-klok-moment";
import { wildsDreamStory, WILDS_DREAM_RUNES, WILDS_DREAM_PREVIEW_UPULSES, WILDS_DREAM_ECHO_UPULSES, type WildsDreamTrial, type WildsDreamTap } from "./wilds-dream-trial";
import styles from "./WildsDreamWorld.module.css";

export default function WildsDreamWorld({trial, companionName, resultMessage, readKaiUPulse, onComplete, onExit}: {
  trial: WildsDreamTrial; companionName: string; readKaiUPulse: () => number;
  onComplete: (taps: readonly WildsDreamTap[]) => void; onExit: () => void;
  resultMessage?: string;
}) {
  const story = useMemo(() => wildsDreamStory(trial), [trial]);
  const [taps, setTaps] = useState<WildsDreamTap[]>([]);
  const [now, setNow] = useState(trial.enteredUPulse);
  const [failed, setFailed] = useState(false);
  const [finished, setFinished] = useState(false);
  const dialog = useRef<HTMLElement>(null);
  const completed = useRef(false);
  const exit = useRef(onExit); exit.current = onExit;
  const round = taps.length < 2 ? 0 : taps.length < 5 ? 1 : 2;
  const roundStartIndex = round === 0 ? 0 : round === 1 ? 2 : 5;
  const roundStarted = roundStartIndex === 0 ? trial.enteredUPulse : taps[roundStartIndex - 1]?.uPulse ?? now;
  const readyAt = roundStarted + WILDS_DREAM_PREVIEW_UPULSES;
  const preview = now < readyAt;
  const elapsed = Math.max(0, now - trial.enteredUPulse);
  const remainingSeconds = Math.max(0, Math.ceil((WILDS_DREAM_ECHO_UPULSES - elapsed) / 1e6 * KAI_PULSE_DURATION_MS / 1000));
  useEffect(() => {
    const priorFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    dialog.current?.focus();
    const handleKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") { event.preventDefault(); event.stopImmediatePropagation(); exit.current(); }
      if (event.key !== "Tab") return;
      const items = [...dialog.current?.querySelectorAll<HTMLButtonElement>("button:not(:disabled)") ?? []];
      const first = items[0], last = items.at(-1);
      if (event.shiftKey && (document.activeElement === first || document.activeElement === dialog.current)) { event.preventDefault(); last?.focus(); }
      else if (!event.shiftKey && (document.activeElement === last || document.activeElement === dialog.current)) { event.preventDefault(); first?.focus(); }
    };
    window.addEventListener("keydown", handleKey);
    return () => { window.removeEventListener("keydown", handleKey); if (priorFocus?.isConnected) priorFocus.focus(); };
  }, []);
  useEffect(() => {
    if (failed || finished) return;
    const tick = () => {
      const pulse = readKaiUPulse(); setNow(pulse);
      if (pulse > trial.enteredUPulse + WILDS_DREAM_ECHO_UPULSES) setFailed(true);
    };
    tick();
    const timer = window.setInterval(tick, 250);
    return () => window.clearInterval(timer);
  }, [failed, finished, readKaiUPulse, trial.enteredUPulse]);
  const choose = (rune: number) => {
    const pulse = readKaiUPulse();
    if (completed.current || failed || pulse < readyAt) return;
    if (pulse > trial.enteredUPulse + WILDS_DREAM_ECHO_UPULSES || rune !== trial.rounds[round][taps.length - roundStartIndex]) {setFailed(true); return;}
    const next = [...taps, {rune, uPulse: pulse}]; setTaps(next); setNow(pulse);
    if (next.length === 9) { completed.current = true; setFinished(true); onComplete(next); }
  };
  return <section className={styles.world} role="dialog" aria-modal="true" aria-labelledby="wilds-dream-title" ref={dialog} tabIndex={-1}
    style={{"--dream-primary": story.expression.ark.visual[0], "--dream-light": story.expression.day.visual[1]} as CSSProperties}>
    <div className={styles.sky} aria-hidden="true" />
    <header><span>Sleeping · {story.expression.day.name} / {story.expression.month.name}</span><button aria-label="Leave dream and keep sleeping" onClick={onExit} type="button"><Icons.close size={20}/></button></header>
    <div className={styles.content}>
      <small>{story.expression.week.name} · Solo dream competition</small>
      <h2 id="wilds-dream-title">{story.title}</h2>
      <p>{story.opening}</p>
      <div className={styles.race} aria-label={`Your echo reaches the gate in ${remainingSeconds} seconds`}><i style={{width: `${Math.min(100, elapsed / WILDS_DREAM_ECHO_UPULSES * 100)}%`}}/><span>Echo · {remainingSeconds}s</span></div>
      <div className={styles.path} aria-label={`${Math.min(3, round + 1)} of 3 patterns`}>
        {[0,1,2].map(index => <span key={index} data-complete={taps.length >= [2,5,9][index]}>{index + 1}</span>)}
      </div>
      {finished ? <div aria-live="polite"><h3>You reached the gate first.</h3><p>{resultMessage ?? `${companionName} completed the dream.`}</p></div>
        : failed ? <div aria-live="polite"><h3>The echo reached this path.</h3><p>No progress was lost. Leave the dream, then tap your sleeping explorer to try a new pattern.</p></div>
        : <><p className={styles.prompt} aria-live="polite">{preview ? "Remember the lights in order." : "Return the pattern from memory."}</p>
          <div className={styles.pattern} aria-label={preview ? "Pattern to remember" : "Hidden pattern"}>{trial.rounds[round].map((rune,index) => <span key={index}>{preview ? WILDS_DREAM_RUNES[rune] : index < taps.length - roundStartIndex ? "✓" : "·"}</span>)}</div>
          <div className={styles.runes}>{WILDS_DREAM_RUNES.map((name,index) => <button key={name} disabled={preview} aria-label={`Choose ${name}`} onClick={() => choose(index)} type="button"><span aria-hidden="true">{["◇","≈","△","✧"][index]}</span>{name}</button>)}</div>
        </>}
      <p className={styles.meaning}>{story.objective}</p>
      <button className={styles.leave} onClick={onExit} type="button">Return to rest</button>
    </div>
  </section>;
}
