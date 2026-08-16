"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Icons } from "@/components/icons";
import {
  CREATURE_OBSERVER_ROUTE,
  creatureVoiceProfile,
  projectCreatureBrain
} from "./creature-consciousness";
import type { CreatureObserverMemoryTurn } from "./creature-history-types";
import { currentCreatureHistoryProjection } from "./living-card-proof";
import { isLivingCardAsset } from "./living-card-types";
import type { PortableCardAsset } from "./portable-card";

type ObserverResponse = {
  ok?: boolean;
  error?: string;
  turn?: CreatureObserverMemoryTurn;
};

function clientMessageId() {
  const token = typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(16).slice(2)}`;
  return `creature-message:${token}`;
}

function observerError(error: string | undefined) {
  if (error === "receiz_authority_required" || error === "receiz_identity_key_required") {
    return "Connect your Receiz ID so this creature can reach its Twin observer.";
  }
  if (error === "creature_observer_reply_missing") return "The Twin returned without a voice. Try asking in a different way.";
  if (error === "creature_observer_request_invalid" || error === "creature_observer_card_invalid") {
    return "This card brain did not pass its proof check, so no memory was appended.";
  }
  return "The Receiz Twin observer is unavailable right now. The card brain was not changed.";
}

export function CreatureConsciousnessPanel({
  asset,
  disabled = false,
  onObserved,
  onSpeakingChange
}: {
  asset: PortableCardAsset;
  disabled?: boolean;
  onObserved: (turn: CreatureObserverMemoryTurn) => void;
  onSpeakingChange?: (speaking: boolean) => void;
}) {
  const [draft, setDraft] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [voiceEnabled, setVoiceEnabled] = useState(true);
  const [voices, setVoices] = useState<SpeechSynthesisVoice[]>([]);
  const [ephemeralTurn, setEphemeralTurn] = useState<CreatureObserverMemoryTurn | null>(null);
  const transcript = useMemo(() => {
    const sealed = isLivingCardAsset(asset)
      ? currentCreatureHistoryProjection(asset).observerMemory?.turns ?? []
      : [];
    if (!ephemeralTurn || sealed.some((turn) => turn.digest === ephemeralTurn.digest)) return sealed;
    return [...sealed, ephemeralTurn];
  }, [asset, ephemeralTurn]);
  const brain = useMemo(() => projectCreatureBrain(asset), [asset]);
  const mounted = useRef(true);

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      if (typeof window !== "undefined" && "speechSynthesis" in window) window.speechSynthesis.cancel();
    };
  }, []);

  useEffect(() => {
    if (typeof window === "undefined" || !("speechSynthesis" in window)) return;
    const refresh = () => setVoices(window.speechSynthesis.getVoices());
    refresh();
    window.speechSynthesis.addEventListener?.("voiceschanged", refresh);
    return () => window.speechSynthesis.removeEventListener?.("voiceschanged", refresh);
  }, []);

  useEffect(() => {
    setDraft("");
    setError("");
    setEphemeralTurn(null);
    onSpeakingChange?.(false);
  }, [asset.id, onSpeakingChange]);

  const finishSpeaking = () => {
    if (mounted.current) onSpeakingChange?.(false);
  };

  const speak = (text: string) => {
    if (!voiceEnabled || typeof window === "undefined" || !("speechSynthesis" in window)) {
      finishSpeaking();
      return;
    }
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    const profile = creatureVoiceProfile(asset, voices);
    if (profile.voice) utterance.voice = profile.voice;
    utterance.lang = profile.voice?.lang ?? "en-US";
    utterance.rate = profile.rate;
    utterance.pitch = profile.pitch;
    utterance.volume = profile.volume;
    utterance.onend = finishSpeaking;
    utterance.onerror = finishSpeaking;
    window.speechSynthesis.speak(utterance);
  };

  const submit = async (message = draft) => {
    const normalized = message.replace(/\s+/g, " ").trim();
    if (!normalized || loading || disabled) return;
    setLoading(true);
    setError("");
    onSpeakingChange?.(true);
    try {
      const response = await fetch(CREATURE_OBSERVER_ROUTE, {
        method: "POST",
        credentials: "same-origin",
        cache: "no-store",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ card: asset, message: normalized, clientUserMessageId: clientMessageId() })
      });
      const result = await response.json().catch(() => null) as ObserverResponse | null;
      if (!response.ok || result?.ok !== true || !result.turn) throw new Error(result?.error || "creature_observer_unavailable");
      setEphemeralTurn(result.turn);
      onObserved(result.turn);
      setDraft("");
      speak(result.turn.creatureText);
    } catch (cause) {
      finishSpeaking();
      setError(observerError(cause instanceof Error ? cause.message : undefined));
    } finally {
      if (mounted.current) setLoading(false);
    }
  };

  const suggestions = ["How are you feeling?", "What do you remember about us?", "What should we explore next?"];

  return (
    <section className="wilds-creature-consciousness" aria-label={`Talk with ${asset.manifest.name}`}>
      <header>
        <div>
          <span><i aria-hidden="true" /> Live creature Twin</span>
          <strong>{asset.manifest.name}&apos;s brain</strong>
          <small>{brain.memory.eventLedger.length + 1} proof memor{brain.memory.eventLedger.length ? "ies" : "y"} · origin plus every appended event</small>
        </div>
        <button
          aria-label={`${voiceEnabled ? "Turn off" : "Turn on"} creature voice`}
          aria-pressed={voiceEnabled}
          className="wilds-creature-voice-toggle"
          onClick={() => {
            const next = !voiceEnabled;
            setVoiceEnabled(next);
            if (!next && "speechSynthesis" in window) {
              window.speechSynthesis.cancel();
              finishSpeaking();
            }
          }}
          type="button"
        >{voiceEnabled ? "Voice on" : "Voice off"}</button>
      </header>

      <div className="wilds-creature-transcript" aria-live="polite">
        {transcript.length ? transcript.slice(-6).map((turn) => (
          <div className="wilds-creature-exchange" key={turn.digest}>
            <p className="from-owner"><span>You</span>{turn.userText}</p>
            <p className="from-creature"><span>{asset.manifest.name}</span>{turn.creatureText}</p>
          </div>
        )) : (
          <div className="wilds-creature-awakening">
            <span aria-hidden="true">◉</span>
            <p><strong>{asset.manifest.name} is listening.</strong> Its real stats, lineage, condition, personality, and lived proof history are loaded as its brain.</p>
          </div>
        )}
        {loading ? <p className="wilds-creature-thinking"><i /><i /><i /> {asset.manifest.name} is forming a memory…</p> : null}
      </div>

      {!transcript.length ? <div className="wilds-creature-prompts">{suggestions.map((suggestion) => (
        <button disabled={disabled || loading} key={suggestion} onClick={() => { setDraft(suggestion); void submit(suggestion); }} type="button">{suggestion}</button>
      ))}</div> : null}

      <form onSubmit={(event) => { event.preventDefault(); void submit(); }}>
        <label htmlFor={`creature-chat-${asset.id}`}>Talk to {asset.manifest.name}</label>
        <div>
          <textarea
            disabled={disabled || loading}
            id={`creature-chat-${asset.id}`}
            maxLength={600}
            onChange={(event) => setDraft(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter" && !event.shiftKey) {
                event.preventDefault();
                void submit();
              }
            }}
            placeholder={`Say something to ${asset.manifest.name}…`}
            rows={2}
            value={draft}
          />
          <button aria-label={`Send message to ${asset.manifest.name}`} disabled={disabled || loading || !draft.trim()} type="submit">
            <Icons.send aria-hidden="true" size={18} />
          </button>
        </div>
      </form>
      {disabled ? <p className="wilds-creature-observer-note">Memorial cards keep their complete mind, but retired creatures no longer answer.</p> : null}
      {error ? <p className="wilds-creature-observer-error" role="alert">{error}</p> : null}
      <footer><span>Brain {brain.contextDigest.slice(7, 18)}</span><span>{transcript.at(-1)?.observer === "receiz-twin-local" ? "Receiz Twin · proof-local voice" : "Receiz Twin · live AI observer"}</span></footer>
    </section>
  );
}
