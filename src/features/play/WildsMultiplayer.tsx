"use client";

import { useEffect, useMemo, useState } from "react";
import { WILDS_INTERACTION_DISTANCE, presenceDistance } from "./multiplayer-core";
import type { WildsMultiplayerController } from "./use-wilds-multiplayer";

function healthPercent(hp: number, maxHp: number) {
  return `${Math.max(0, Math.min(100, (hp / maxHp) * 100))}%`;
}

export function WildsMultiplayer({ multiplayer, position }: { multiplayer: WildsMultiplayerController; position: { x: number; z: number } }) {
  const [rosterOpen, setRosterOpen] = useState(false);
  const [chatOpen, setChatOpen] = useState(false);
  const [message, setMessage] = useState("");
  const [notice, setNotice] = useState("");
  const selected = multiplayer.selectedPlayer;
  const selectedDistance = selected ? presenceDistance(selected, position) : Infinity;
  const canInteract = selectedDistance <= WILDS_INTERACTION_DISTANCE && selected?.status === "available";
  const battle = multiplayer.activeBattle;
  const battlePlayers = useMemo(() => battle ? battle.playerOrder.map((id) => battle.players[id]!) : [], [battle]);
  const myIntentPending = Boolean(battle?.pendingIntents[multiplayer.selfId]);
  useEffect(() => {
    if (!notice) return;
    const timer = window.setTimeout(() => setNotice(""), 2_800);
    return () => window.clearTimeout(timer);
  }, [notice]);

  return (
    <>
      <div className="wilds-live-cluster" aria-label="Live multiplayer">
        <button aria-label={`Open nearby explorers · ${multiplayer.mode === "receiz_live" ? "live room" : multiplayer.mode === "local_practice" ? "practice room" : "syncing"}`} className={`wilds-live-badge ${multiplayer.mode}`} onClick={() => setRosterOpen((value) => !value)} type="button">
          <i />
          <span>{multiplayer.remotePlayers.length}</span>
        </button>
        <button aria-label="Copy invite link" className="wilds-live-share" onClick={async () => {
          try {
            await multiplayer.createInviteLink();
            setNotice("Invite link copied — anyone opening it joins this live room.");
          } catch {
            setNotice("Copy was blocked. Use your browser share control for this page.");
          }
        }} type="button"><svg aria-hidden="true" viewBox="0 0 24 24"><circle cx="18" cy="5" r="2.5" /><circle cx="6" cy="12" r="2.5" /><circle cx="18" cy="19" r="2.5" /><path d="m8.2 10.8 7.6-4.5M8.2 13.2l7.6 4.5" /></svg></button>
      </div>

      {rosterOpen ? (
        <section className="wilds-live-sheet wilds-live-roster" aria-label="Nearby live explorers">
          <header><div><span>Shared Wilds</span><strong>Nearby explorers</strong></div><button onClick={() => setRosterOpen(false)} aria-label="Close live roster" type="button">×</button></header>
          <p>{multiplayer.mode === "receiz_live" ? "Verified Receiz room" : "Local practice room · sign in for durable cross-device presence"}</p>
          <div className="wilds-live-player-list">
            {multiplayer.remotePlayers.length ? multiplayer.remotePlayers.map((player) => (
              <button key={player.playerId} onClick={() => { multiplayer.selectPlayer(player); setRosterOpen(false); }} type="button">
                <i className={player.style} /><span><strong>{player.handle}</strong><small>{Math.round(presenceDistance(player, position))}m · {player.activeCard.name}</small></span><b>{player.status}</b>
              </button>
            )) : <div className="wilds-live-empty"><strong>The trail is quiet.</strong><span>Share the invite link and another explorer will appear here live.</span></div>}
          </div>
          <button className="wilds-live-chat-toggle" onClick={() => setChatOpen((value) => !value)} type="button">{chatOpen ? "Close room chat" : "Open room chat"}</button>
          {chatOpen ? <form className="wilds-live-chat" onSubmit={async (event) => {
            event.preventDefault();
            if (!message.trim()) return;
            try { await multiplayer.sendMessage(message); setMessage(""); } catch (cause) { setNotice(cause instanceof Error ? cause.message : "Message not sent"); }
          }}>
            <div>{multiplayer.snapshot?.messages.slice(-8).map((item) => <p key={item.id}><b>{item.senderHandle}</b><span>{item.text}</span></p>)}</div>
            <label><span className="sr-only">Room message</span><input maxLength={280} onChange={(event) => setMessage(event.target.value)} placeholder="Say something kind…" value={message} /><button type="submit">Send</button></label>
          </form> : null}
        </section>
      ) : null}

      {selected ? (
        <section className="wilds-live-sheet wilds-player-sheet" aria-label={`Interact with ${selected.handle}`}>
          <header><div><span>{selected.practice ? "Practice explorer" : "Verified explorer"}</span><strong>{selected.handle}</strong></div><button onClick={() => multiplayer.selectPlayer(null)} aria-label="Close player interaction" type="button">×</button></header>
          <div className="wilds-player-card-line"><i className={selected.style} /><span><strong>{selected.activeCard.name}</strong><small>{selected.activeCard.stats.health} HP · {selected.activeCard.stats.power} power · {Math.round(selectedDistance)}m away</small></span></div>
          {!canInteract ? <p className="wilds-live-distance">Move within {WILDS_INTERACTION_DISTANCE}m to chat or battle.</p> : null}
          <div className="wilds-challenge-modes">
            <button disabled={!canInteract} onClick={async () => {
              try { await multiplayer.offerChallenge(selected.playerId); setNotice(`Friendly battle sent to ${selected.handle}.`); multiplayer.selectPlayer(null); }
              catch (cause) { setNotice(cause instanceof Error ? cause.message : "Challenge not sent"); }
            }} type="button"><strong>Friendly battle</strong><span>Proof-sealed result · no custody transfer</span></button>
            <button disabled type="button"><strong>Card stake</strong><span>Awaiting Receiz atomic asset exchange</span></button>
            <button disabled type="button"><strong>Funds</strong><span>Compliance locked</span></button>
          </div>
        </section>
      ) : null}

      {multiplayer.incomingChallenge ? (
        <section className="wilds-live-sheet wilds-challenge-incoming" role="dialog" aria-modal="true" aria-label="Incoming Wilds battle challenge">
          <span>Challenge signal</span>
          <h3>{multiplayer.snapshot?.players.find((player) => player.playerId === multiplayer.incomingChallenge?.challengerId)?.handle ?? "A nearby explorer"} wants to battle</h3>
          <p>{multiplayer.incomingChallenge.challengerCard.name} · Friendly mode · no cards or funds change hands</p>
          <div><button onClick={() => void multiplayer.answerChallenge(multiplayer.incomingChallenge!.id, "decline")} type="button">Decline</button><button className="primary" onClick={() => void multiplayer.answerChallenge(multiplayer.incomingChallenge!.id, "accept")} type="button">Accept battle</button></div>
        </section>
      ) : null}

      {battle ? (
        <section className={`wilds-pvp-battle ${battle.phase}`} aria-label="Live player battle">
          <header><span>LIVE DUEL</span><strong>TURN {battle.turn}</strong><small>{battle.phase === "settled" ? "Proof sealed" : myIntentPending ? "Waiting for opponent" : "Choose your move"}</small></header>
          <div className="wilds-pvp-fighters">
            {battlePlayers.map((player) => <div key={player.playerId} className={player.playerId === multiplayer.selfId ? "self" : "opponent"}><span>{player.playerId === multiplayer.selfId ? "YOU" : "RIVAL"}</span><strong>{player.card.name}</strong><div role="progressbar" aria-label={`${player.card.name} health`} aria-valuemax={player.maxHp} aria-valuemin={0} aria-valuenow={player.hp}><i style={{ width: healthPercent(player.hp, player.maxHp) }} /></div><small>{player.hp}/{player.maxHp} HP</small></div>)}
          </div>
          <p>{battle.transcript.at(-1)?.actions.map((action) => action.detail).join(" ") ?? "Both proof-pinned companions enter the arena."}</p>
          {battle.phase === "active" ? <div className="wilds-pvp-actions">
            {battle.players[multiplayer.selfId]?.card.abilities.map((ability, slot) => <button disabled={myIntentPending} key={ability.name} onClick={() => void multiplayer.submitIntent(battle.id, { type: "ability", slot: slot as 0 | 1 })} type="button"><strong>{ability.name}</strong><span>{ability.power} power</span></button>)}
            <button disabled={myIntentPending} onClick={() => void multiplayer.submitIntent(battle.id, { type: "guard" })} type="button"><strong>Guard</strong><span>Reduce incoming damage</span></button>
          </div> : <div className="wilds-pvp-result"><strong>{battle.winnerId === multiplayer.selfId ? "Victory" : battle.winnerId ? "Battle complete" : "Draw"}</strong><span>{battle.resultReason} · {battle.transcript.at(-1)?.digest.slice(0, 20)}</span><button onClick={() => multiplayer.dismissBattle(battle.id)} type="button">Return to world</button></div>}
        </section>
      ) : null}

      {notice || multiplayer.error ? <div className="wilds-live-notice" aria-live="polite">{notice || multiplayer.error}</div> : null}
    </>
  );
}
