"use client";

import { useEffect, useRef, useState } from "react";
import { WildsRoamingBattle, type WildsRoamingBattleProps } from "./WildsRoamingBattle";
import { sealCollectedCard, evolvePortableCard, type PortableCardAsset } from "./portable-card";
import { createWildsRoamingBattle, submitWildsRoamingBattleIntent, type WildsRoamingBattle as Battle,
  type WildsRoamingBattleIntent } from "./wilds-roaming-battle";

const at = "2026-09-13T12:00:00.000Z";
function creature(owner: string, strength: 1 | 3) {
  let card: PortableCardAsset = sealCollectedCard({ formId: "voltray-1", ownerReceizId: owner, encounterId: `${owner}-fixture`, capturedAt: at });
  if (strength === 3) {
    card = evolvePortableCard({ previous: card, nextFormId: "voltray-2", evolvedAt: at });
    card = evolvePortableCard({ previous: card, nextFormId: "voltray-3", evolvedAt: at });
  }
  return card;
}
function start(strongerChallenger: boolean) {
  const assets = { challengerAsset: creature("challenger", strongerChallenger ? 3 : 1), defenderAsset: creature("defender", strongerChallenger ? 1 : 3) };
  const session = createWildsRoamingBattle({ ...assets, sessionId: "roaming:test", challengerId: "challenger", defenderId: "defender", kaiUPulse: 100, at });
  return { assets, session };
}
function move(state: ReturnType<typeof start>, intent: WildsRoamingBattleIntent) {
  const session = state.session;
  return { ...state, session: submitWildsRoamingBattleIntent(session, { ...state.assets, sessionId: session.sessionId,
    actorId: session.challengerId, expectedTurn: session.battle.turn, expectedRevision: session.revision,
    intentId: `fixture:${session.revision}`, intent, kaiUPulse: session.kaiUPulse + 1, at }) };
}

/** Development-only UI fixture. Kernel combat is real; every capture status is
 * simulated locally. This component never calls native ownership or the network. */
export function RoamingBattleBrowserFixture() {
  const [state, setState] = useState(() => start(true));
  const [open, setOpen] = useState(false);
  const [phase, setPhase] = useState<WildsRoamingBattleProps["phase"]>("battle");
  const [pending, setPending] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => () => { if (timer.current) clearTimeout(timer.current); }, []);
  function schedule(action: () => void, delay = 350) {
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => { timer.current = null; action(); }, delay);
  }
  function showOutcome(session: Battle) {
    if (session.outcome === "capture-eligible") {
      setPhase("waiting"); schedule(() => setPhase("offered"), 600);
    } else setPhase(session.outcome === "active" ? "battle" : "ended");
  }
  function begin(strongerChallenger: boolean, complete = false) {
    if (timer.current) clearTimeout(timer.current);
    let next = start(strongerChallenger);
    if (complete) while (next.session.outcome === "active") next = move(next, { type: "ability", slot: 1 });
    setState(next); setPending(false); setOpen(true); showOutcome(next.session);
  }
  function intent(value: WildsRoamingBattleIntent) {
    if (pending || state.session.outcome !== "active") return;
    const next = move(state, value); setPending(true);
    schedule(() => { setState(next); setPending(false); showOutcome(next.session); });
  }
  return <main style={{ minHeight: "100vh", padding: "5rem 2rem", background: "#071411", color: "#edfff3", fontFamily: "system-ui" }}>
    <aside style={{ position: "fixed", top: 8, left: 8, zIndex: 100000, padding: "8px 12px", background: "#152923", color: "#edfff3", border: "1px solid #83ad90", borderRadius: 8, pointerEvents: "none" }}>
      SIMULATION ONLY · no accounts, native claims, or network calls
    </aside>
    <h1>Roaming battle browser fixture</h1>
    <p>Both creatures use the actual combat kernel. Capture preparation and confirmation below are simulated.</p>
    <div style={{ display: "flex", flexWrap: "wrap", gap: 12 }}>
      <button type="button" onClick={() => begin(true)}>Fight with stronger challenger</button>
      <button type="button" onClick={() => begin(false)}>Fight with stronger defender</button>
      <button type="button" onClick={() => begin(true, true)}>Simulate capture after a replayed win</button>
      <button type="button" onClick={() => begin(false, true)}>Show defender victory</button>
    </div>
    <p data-testid="fixture-phase">Fixture phase: {phase}. Outcome: {state.session.outcome}.</p>
    <WildsRoamingBattle open={open} session={state.session} phase={phase} pending={pending} error=""
      onIntent={intent} onClaim={() => { if (phase !== "offered" || pending) return; setPending(true);
        schedule(() => { setPending(false); setPhase("captured"); }, 600); }}
      onClose={() => { if (timer.current) clearTimeout(timer.current); setPending(false); setOpen(false); }} />
  </main>;
}
