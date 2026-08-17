"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Icons } from "@/components/icons";
import {
  CREATURE_OBSERVER_ROUTE,
  creatureVoicePerformance,
  creatureVoiceProfile,
  projectCreatureBrain
} from "./creature-consciousness";
import type { CreatureObserverMemoryTurn } from "./creature-history-types";
import { currentCreatureHistoryProjection } from "./living-card-proof";
import { isLivingCardAsset } from "./living-card-types";
import type { PortableCardAsset } from "./portable-card";
import type { KaiKlokMoment } from "./kai-klok-moment";
import {
  cancelCreatureNeuralVoice,
  isCreatureNeuralVoiceReady,
  playCreatureNeuralVoice,
  unlockCreatureNeuralVoice,
  warmCreatureNeuralVoice
} from "./creature-neural-voice";

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

function emitCreatureMouthMotion(assetId: string, openness: number) {
  window.dispatchEvent(new CustomEvent("wildz-creature-mouth", {
    detail: { assetId, openness: Math.max(0, Math.min(1, openness)) }
  }));
}

function observerError(error: string | undefined) {
  if (error === "receiz_authority_required" || error === "receiz_profile_required" || error === "receiz_identity_key_required") {
    return "Wildz could not verify the active Receiz identity for this card. Reopen your Identity Seal or Vault and try again.";
  }
  if (error === "creature_observer_owner_mismatch") {
    return "This creature can answer only through its current owner's Receiz ID.";
  }
  if (error === "creature_observer_reply_missing") return "The Twin returned without a voice. Try asking in a different way.";
  if (error === "creature_observer_intelligence_unavailable" || error === "creature_observer_timeout") {
    return "This creature's live intelligence could not answer yet. Nothing canned was substituted and no memory was changed—try once more.";
  }
  if (error === "creature_observer_request_invalid" || error === "creature_observer_card_invalid") {
    return "This card brain did not pass its proof check, so no memory was appended.";
  }
  return "The Receiz Twin observer is unavailable right now. The card brain was not changed.";
}

export function CreatureConsciousnessPanel({
  asset,
  kaiMoment,
  playerPosition,
  disabled = false,
  onObserved,
  onSpeakingChange
}: {
  asset: PortableCardAsset;
  kaiMoment: KaiKlokMoment;
  playerPosition: Readonly<{ x: number; z: number }>;
  disabled?: boolean;
  onObserved: (turn: CreatureObserverMemoryTurn) => void;
  onSpeakingChange?: (speaking: boolean) => void;
}) {
  const [draft, setDraft] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [voiceEnabled, setVoiceEnabled] = useState(true);
  const [voices, setVoices] = useState<SpeechSynthesisVoice[]>([]);
  const [voiceMode, setVoiceMode] = useState<"native" | "warming" | "neural">("native");
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
  const speechRun = useRef(0);
  const speechTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const neuralSpeech = useRef<AbortController | null>(null);
  const activeUtterances = useRef<SpeechSynthesisUtterance[]>([]);
  const nativeMouthFrame = useRef<number | null>(null);

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      speechRun.current += 1;
      neuralSpeech.current?.abort();
      cancelCreatureNeuralVoice();
      if (nativeMouthFrame.current) cancelAnimationFrame(nativeMouthFrame.current);
      emitCreatureMouthMotion(asset.id, 0);
      activeUtterances.current = [];
      if (speechTimer.current) clearTimeout(speechTimer.current);
      if (typeof window !== "undefined" && "speechSynthesis" in window) window.speechSynthesis.cancel();
    };
  }, [asset.id]);

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
    speechRun.current += 1;
    neuralSpeech.current?.abort();
    cancelCreatureNeuralVoice();
    if (nativeMouthFrame.current) cancelAnimationFrame(nativeMouthFrame.current);
    nativeMouthFrame.current = null;
    emitCreatureMouthMotion(asset.id, 0);
    activeUtterances.current = [];
    if (speechTimer.current) clearTimeout(speechTimer.current);
    if (typeof window !== "undefined" && "speechSynthesis" in window) window.speechSynthesis.cancel();
    onSpeakingChange?.(false);
  }, [asset.id, onSpeakingChange]);

  useEffect(() => {
    // Begin model loading while the Vault card is visible. Once cached by the
    // browser, later conversations start directly in the character voice.
    void warmCreatureNeuralVoice(asset);
  }, [asset]);

  const finishSpeaking = () => {
    if (nativeMouthFrame.current) cancelAnimationFrame(nativeMouthFrame.current);
    nativeMouthFrame.current = null;
    if (typeof window !== "undefined") emitCreatureMouthMotion(asset.id, 0);
    if (mounted.current) onSpeakingChange?.(false);
  };

  const speak = async (text: string) => {
    if (!voiceEnabled || typeof window === "undefined" || !("speechSynthesis" in window)) {
      finishSpeaking();
      return;
    }
    speechRun.current += 1;
    const run = speechRun.current;
    neuralSpeech.current?.abort();
    if (nativeMouthFrame.current) cancelAnimationFrame(nativeMouthFrame.current);
    nativeMouthFrame.current = null;
    emitCreatureMouthMotion(asset.id, 0);
    const neuralController = new AbortController();
    neuralSpeech.current = neuralController;
    if (speechTimer.current) clearTimeout(speechTimer.current);
    activeUtterances.current = [];
    window.speechSynthesis.cancel();
    const neuralTimeoutMs = isCreatureNeuralVoiceReady(asset) ? 10_500 : 900;
    const neuralPlayed = await Promise.race([
      playCreatureNeuralVoice(asset, text, neuralController.signal, () => {
        if (mounted.current && run === speechRun.current) finishSpeaking();
      }).catch(() => false),
      new Promise<false>((resolve) => setTimeout(() => resolve(false), neuralTimeoutMs))
    ]);
    if (neuralPlayed) {
      if (run === speechRun.current) {
        setVoiceMode("neural");
      }
      return;
    }
    neuralController.abort();
    if (!mounted.current || run !== speechRun.current) return;
    setVoiceMode("native");
    const profile = creatureVoiceProfile(asset, voices);
    const performance = creatureVoicePerformance(asset, text);
    const perform = (index: number) => {
      if (!mounted.current || run !== speechRun.current) return;
      const segment = performance[index];
      if (!segment) {
        finishSpeaking();
        return;
      }
      const utterance = new SpeechSynthesisUtterance(segment.text);
      if (profile.voice) utterance.voice = profile.voice;
      utterance.lang = profile.voice?.lang ?? "en-US";
      utterance.rate = Math.max(.86, Math.min(1.08, (profile.rate + segment.rate) / 2));
      utterance.pitch = Math.max(.92, Math.min(1.08, (profile.pitch + segment.pitch) / 2));
      utterance.volume = Math.min(profile.volume, segment.volume);
      const mouthStartedAt = window.performance.now();
      const estimatedDuration = Math.max(520, segment.text.length * 58 / Math.max(.8, utterance.rate));
      const animateNativeMouth = (now: number) => {
        if (!mounted.current || run !== speechRun.current) return;
        const progress = Math.min(.999, (now - mouthStartedAt) / estimatedDuration);
        const character = segment.text[Math.floor(progress * segment.text.length)] ?? " ";
        const voiced = /[aeiouy]/i.test(character) ? .82 : /[bcdfgjklmnprstvwz]/i.test(character) ? .42 : .08;
        const cadence = .72 + Math.sin((now - mouthStartedAt) * .038) * .18;
        emitCreatureMouthMotion(asset.id, voiced * cadence);
        nativeMouthFrame.current = requestAnimationFrame(animateNativeMouth);
      };
      utterance.onend = () => {
        if (!mounted.current || run !== speechRun.current) return;
        if (nativeMouthFrame.current) cancelAnimationFrame(nativeMouthFrame.current);
        nativeMouthFrame.current = null;
        emitCreatureMouthMotion(asset.id, 0);
        speechTimer.current = setTimeout(() => perform(index + 1), segment.pauseAfterMs);
      };
      utterance.onerror = () => {
        if (run === speechRun.current) finishSpeaking();
      };
      activeUtterances.current = [utterance];
      window.speechSynthesis.speak(utterance);
      nativeMouthFrame.current = requestAnimationFrame(animateNativeMouth);
      if (window.speechSynthesis.paused) window.speechSynthesis.resume();
      speechTimer.current = setTimeout(() => {
        if (run === speechRun.current && window.speechSynthesis.paused) window.speechSynthesis.resume();
      }, 250);
    };
    perform(0);
  };

  const submit = async (message = draft) => {
    const normalized = message.replace(/\s+/g, " ").trim();
    if (!normalized || loading || disabled) return;
    if (voiceEnabled) {
      setVoiceMode("warming");
      void unlockCreatureNeuralVoice().catch(() => undefined);
      void warmCreatureNeuralVoice(asset);
    }
    setLoading(true);
    setError("");
    onSpeakingChange?.(true);
    try {
      const response = await fetch(CREATURE_OBSERVER_ROUTE, {
        method: "POST",
        credentials: "same-origin",
        cache: "no-store",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          card: asset,
          message: normalized,
          clientUserMessageId: clientMessageId(),
          kai: {
            uPulse: kaiMoment.uPulse,
            authority: kaiMoment.authority,
            playerPosition
          }
        })
      });
      const result = await response.json().catch(() => null) as ObserverResponse | null;
      if (!response.ok || result?.ok !== true || !result.turn) throw new Error(result?.error || "creature_observer_unavailable");
      setEphemeralTurn(result.turn);
      onObserved(result.turn);
      setDraft("");
      void speak(result.turn.creatureText);
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
          <small>Innate self · capture bond · {brain.memory.eventLedger.length} proof event{brain.memory.eventLedger.length === 1 ? "" : "s"}</small>
        </div>
        <button
          aria-label={`${voiceEnabled ? "Turn off" : "Turn on"} creature voice`}
          aria-pressed={voiceEnabled}
          className="wilds-creature-voice-toggle"
          onClick={() => {
            const next = !voiceEnabled;
            setVoiceEnabled(next);
            if (!next && "speechSynthesis" in window) {
              speechRun.current += 1;
              neuralSpeech.current?.abort();
              cancelCreatureNeuralVoice();
              if (nativeMouthFrame.current) cancelAnimationFrame(nativeMouthFrame.current);
              nativeMouthFrame.current = null;
              emitCreatureMouthMotion(asset.id, 0);
              activeUtterances.current = [];
              if (speechTimer.current) clearTimeout(speechTimer.current);
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
      <footer>
        <span>Brain {brain.contextDigest.slice(7, 18)}</span>
        <span>{transcript.at(-1)?.observer === "receiz-twin" ? "Receiz Twin · genuine upstream" : "Receiz Twin · proof-grounded local"}</span>
        <span>{voiceMode === "neural" ? "Local neural character voice" : voiceMode === "warming" ? "Local neural voice awakening" : "Native character voice"}</span>
      </footer>
    </section>
  );
}
