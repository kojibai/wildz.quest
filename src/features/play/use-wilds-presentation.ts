"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  DEFAULT_WILDS_AUDIO_SETTINGS,
  audioCuesForTransition,
  createWildsAudioRuntime,
  normalizeWildsAudioSettings,
  type WildsAudioContextLike,
  type WildsAudioSettings,
  type WildsEncounterAudioState
} from "@/features/play/wilds-audio";
import {
  activeWildsVisualEvents,
  appendWildsVisualEvent,
  type WildsVisualEvent,
  type WildsVisualEventKind
} from "@/features/play/wilds-visual-events";

const WILDS_AUDIO_KEY = "receiz:wilds:audio:v1";

function restoreAudioSettings() {
  if (typeof window === "undefined") return { ...DEFAULT_WILDS_AUDIO_SETTINGS };
  try {
    const saved = window.localStorage.getItem(WILDS_AUDIO_KEY);
    return normalizeWildsAudioSettings(saved ? JSON.parse(saved) : null);
  } catch {
    return { ...DEFAULT_WILDS_AUDIO_SETTINGS };
  }
}

function browserAudioContext() {
  const AudioContextConstructor = window.AudioContext
    ?? (window as typeof window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!AudioContextConstructor) throw new Error("Web Audio is unavailable in this browser.");
  return new AudioContextConstructor() as unknown as WildsAudioContextLike;
}

function eventKindForPhase(phase: string): WildsVisualEventKind | null {
  if (phase === "searching") return "search";
  if (phase === "hint") return "rustle";
  if (phase === "emerging") return "emerge";
  if (phase === "capsule") return "capture";
  if (phase === "sealed") return "seal";
  if (phase === "revealed") return "reveal";
  return null;
}

export function useWildsPresentation({
  encounter,
  enabled
}: {
  encounter: WildsEncounterAudioState;
  enabled: boolean;
}) {
  const [audioSettings, setAudioSettingsState] = useState<WildsAudioSettings>(restoreAudioSettings);
  const [audioReady, setAudioReady] = useState(false);
  const [visualEvents, setVisualEvents] = useState<WildsVisualEvent[]>([]);
  const runtimeRef = useRef<ReturnType<typeof createWildsAudioRuntime> | null>(null);
  const previousEncounter = useRef<WildsEncounterAudioState>({
    phase: encounter.phase,
    proximity: encounter.proximity
  });
  const transitionSequence = useRef(0);

  useEffect(() => {
    if (!enabled) return;
    const runtime = createWildsAudioRuntime(browserAudioContext);
    runtimeRef.current = runtime;
    return () => {
      if (runtimeRef.current === runtime) runtimeRef.current = null;
      void runtime.destroy();
    };
  }, [enabled]);

  const unlockAudio = useCallback(async () => {
    const runtime = runtimeRef.current;
    if (!runtime) return;
    try {
      await runtime.unlock();
      runtime.setSettings(audioSettings);
      runtime.startAmbience();
      setAudioReady(true);
    } catch {
      setAudioReady(false);
    }
  }, [audioSettings]);

  useEffect(() => {
    if (!enabled || audioReady) return;
    const unlock = () => { void unlockAudio(); };
    window.addEventListener("pointerdown", unlock, { once: true });
    return () => window.removeEventListener("pointerdown", unlock);
  }, [audioReady, enabled, unlockAudio]);

  useEffect(() => {
    const runtime = runtimeRef.current;
    runtime?.setSettings(audioSettings);
    if (audioReady && !audioSettings.muted) runtime?.startAmbience();
    try {
      window.localStorage.setItem(WILDS_AUDIO_KEY, JSON.stringify(audioSettings));
    } catch {
      // Audio settings remain active for this session when persistence is blocked.
    }
  }, [audioReady, audioSettings]);

  useEffect(() => {
    const previous = previousEncounter.current;
    const next = { phase: encounter.phase, proximity: encounter.proximity };
    if (previous.phase === next.phase && previous.proximity === next.proximity) return;
    const now = Date.now();
    audioCuesForTransition(previous, next).forEach((cue) => runtimeRef.current?.play(cue));
    const kind = eventKindForPhase(next.phase);
    if (kind) {
      transitionSequence.current += 1;
      setVisualEvents((current) => appendWildsVisualEvent(current, {
        id: `${kind}:${transitionSequence.current}`,
        kind,
        createdAt: now,
        durationMs: kind === "reveal" ? 1_800 : 900,
        intensity: next.proximity === "hot" ? 1 : 0.72
      }, now));
    } else {
      setVisualEvents((current) => activeWildsVisualEvents(current, now));
    }
    previousEncounter.current = next;
  }, [encounter.phase, encounter.proximity]);

  const setAudioSettings = useCallback((next: WildsAudioSettings) => {
    setAudioSettingsState(normalizeWildsAudioSettings(next));
  }, []);

  return {
    audioSettings,
    setAudioSettings,
    audioReady,
    unlockAudio,
    visualEvents
  };
}
