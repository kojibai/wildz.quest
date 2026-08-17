"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Icons } from "@/components/icons";
import {
  CREATURE_OBSERVER_ROUTE,
  projectCreatureBrain
} from "./creature-consciousness";
import type { CreatureObserverMemoryTurn } from "./creature-history-types";
import { currentCreatureHistoryProjection } from "./living-card-proof";
import { isLivingCardAsset } from "./living-card-types";
import type { PortableCardAsset } from "./portable-card";
import type { KaiKlokMoment } from "./kai-klok-moment";
import type { WildzVaultCardMembershipProof } from "@/lib/receiz/wildz-vault-card-admission";
import { cancelCreatureVoice, playCreatureVoice, unlockCreatureVoice } from "./creature-voice-playback";

type ObserverResponse = {
  ok?: boolean;
  error?: string;
  turn?: CreatureObserverMemoryTurn;
  voice?: {
    source: "receiz-twin-generated";
    dataUrl: string;
    mimeType: string;
    durationMs: number | null;
    provider: string;
    model: string | null;
    signature: string;
  } | null;
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
  if (error === "creature_observer_voice_unavailable") {
    return "This creature's unique Receiz voice was unavailable. No substitute voice was used—try once more.";
  }
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
  cardAdmission = null,
  disabled = false,
  onObserved,
  onSpeakingChange
}: {
  asset: PortableCardAsset;
  kaiMoment: KaiKlokMoment;
  playerPosition: Readonly<{ x: number; z: number }>;
  cardAdmission?: WildzVaultCardMembershipProof | null;
  disabled?: boolean;
  onObserved: (turn: CreatureObserverMemoryTurn) => void;
  onSpeakingChange?: (speaking: boolean) => void;
}) {
  const [draft, setDraft] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [voiceEnabled, setVoiceEnabled] = useState(true);
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
  const voiceRun = useRef(0);
  const voicePlayback = useRef<AbortController | null>(null);

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      voiceRun.current += 1;
      voicePlayback.current?.abort();
      cancelCreatureVoice();
      emitCreatureMouthMotion(asset.id, 0);
    };
  }, [asset.id]);

  useEffect(() => {
    setDraft("");
    setError("");
    setEphemeralTurn(null);
    voiceRun.current += 1;
    voicePlayback.current?.abort();
    cancelCreatureVoice();
    emitCreatureMouthMotion(asset.id, 0);
    onSpeakingChange?.(false);
  }, [asset.id, onSpeakingChange]);

  const finishSpeaking = () => {
    if (typeof window !== "undefined") emitCreatureMouthMotion(asset.id, 0);
    if (mounted.current) onSpeakingChange?.(false);
  };

  const speak = async (voice: NonNullable<ObserverResponse["voice"]>) => {
    if (!voiceEnabled || typeof window === "undefined") {
      finishSpeaking();
      return;
    }
    voiceRun.current += 1;
    const run = voiceRun.current;
    voicePlayback.current?.abort();
    const controller = new AbortController();
    voicePlayback.current = controller;
    const played = await playCreatureVoice(asset, voice.dataUrl, controller.signal, () => {
      if (mounted.current && run === voiceRun.current) finishSpeaking();
    });
    if (played || !mounted.current || run !== voiceRun.current) return;
    setError("This creature's unique Receiz voice could not play. No substitute voice was used.");
    finishSpeaking();
  };

  const submit = async (message = draft) => {
    const normalized = message.replace(/\s+/g, " ").trim();
    if (!normalized || loading || disabled) return;
    if (voiceEnabled) void unlockCreatureVoice().catch(() => false);
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
          ...(cardAdmission ? { cardAdmission } : {}),
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
      if (!response.ok || result?.ok !== true || !result.turn || !result.voice) {
        throw new Error(result?.error || "creature_observer_voice_unavailable");
      }
      setEphemeralTurn(result.turn);
      onObserved(result.turn);
      setDraft("");
      void speak(result.voice);
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
            if (!next) {
              voiceRun.current += 1;
              voicePlayback.current?.abort();
              cancelCreatureVoice();
              emitCreatureMouthMotion(asset.id, 0);
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

      <form onSubmit={(event) => {
        event.preventDefault();
        event.currentTarget.querySelector("textarea")?.blur();
        void submit();
      }}>
        <label htmlFor={`creature-chat-${asset.id}`}>Talk to {asset.manifest.name}</label>
        <div>
          <textarea
            disabled={disabled || loading}
            enterKeyHint="send"
            id={`creature-chat-${asset.id}`}
            maxLength={600}
            onChange={(event) => setDraft(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter" && !event.shiftKey) {
                event.preventDefault();
                event.currentTarget.blur();
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
        <span>Unique Receiz character voice · zero client warm-up</span>
      </footer>
    </section>
  );
}
