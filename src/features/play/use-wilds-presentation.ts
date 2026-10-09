"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  DEFAULT_WILDS_AUDIO_SETTINGS,
  audioCuesForTransition,
  createWildsAudioRuntime,
  normalizeWildsAudioSettings,
  type WildsAudioContextLike,
  type WildsAudioCue,
  type WildsAudioSettings,
  type WildsEncounterAudioState
} from "@/features/play/wilds-audio";
import {
  activeWildsVisualEvents,
  appendWildsVisualEvent,
  type WildsVisualEvent,
  type WildsVisualEventKind
} from "@/features/play/wilds-visual-events";
import type { WildsAudioScene } from "@/features/play/wilds-audio-scene";
import { createWildsEmbodiedAudioPlanner, WILDS_EMBODIED_AUDIO_ASSETS, type WildsEmbodiedSnapshot } from "./wilds-embodied-audio";
import { wildzGameplayBackground } from "../../lib/performance/wildz-gameplay-background";

function restoreAudioSettings(initial?: unknown) {
  return initial ? normalizeWildsAudioSettings(initial) : { ...DEFAULT_WILDS_AUDIO_SETTINGS };
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
  audioScene,
  enabled,
  embodiedEnabled = false,
  readEmbodiedSnapshot,
  initialAudioSettings
}: {
  encounter: WildsEncounterAudioState;
  audioScene?: WildsAudioScene;
  enabled: boolean;
  embodiedEnabled?: boolean;
  readEmbodiedSnapshot?: () => WildsEmbodiedSnapshot;
  initialAudioSettings?: unknown;
}) {
  const [audioSettings, setAudioSettingsState] = useState<WildsAudioSettings>(() => restoreAudioSettings(initialAudioSettings));
  const [audioReady, setAudioReady] = useState(false);
  const [visualEvents, setVisualEvents] = useState<WildsVisualEvent[]>([]);
  const runtimeRef = useRef<ReturnType<typeof createWildsAudioRuntime> | null>(null);
  const audioSettingsRef = useRef(audioSettings);
  const previousEncounter = useRef<WildsEncounterAudioState>({
    phase: encounter.phase,
    proximity: encounter.proximity
  });
  const transitionSequence = useRef(0);
  const embodiedSnapshotRef = useRef(readEmbodiedSnapshot);
  embodiedSnapshotRef.current = readEmbodiedSnapshot;

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
      if (runtimeRef.current !== runtime) return;
      runtime.setSettings(audioSettingsRef.current);
      runtime.startAmbience();
      setAudioReady(true);
      void runtime.preload([
        "receiz-kai-turah-signature",
        "ui-confirm",
        "ui-error",
        "strike-slice",
        "door-open",
        "proof-latch"
      ]).catch(() => {
        // Sample loading is optional; cues can use their synthesized voices.
      });
    } catch {
      if (runtimeRef.current === runtime) setAudioReady(false);
    }
  }, []);

  useEffect(() => {
    if (!enabled || audioReady || audioSettings.muted) return;
    const unlock = () => { void unlockAudio(); };
    window.addEventListener("pointerdown", unlock, { once: true });
    return () => window.removeEventListener("pointerdown", unlock);
  }, [audioReady, audioSettings.muted, enabled, unlockAudio]);

  useEffect(() => {
    const runtime = runtimeRef.current;
    runtime?.setSettings(audioSettings);
    if (audioReady && !audioSettings.muted) runtime?.startAmbience();
  }, [audioReady, audioSettings]);

  useEffect(() => {
    if (!audioReady || !audioScene || audioSettings.muted) return;
    void runtimeRef.current?.setScene(audioScene);
  }, [audioReady, audioScene, audioSettings.muted]);

  useEffect(() => {
    if (!audioReady || !embodiedEnabled || audioSettings.muted) return;
    const runtime = runtimeRef.current;
    if (!runtime) return;
    const preload = runtime.preload;
    let active = true, timer: ReturnType<typeof setInterval> | undefined;
    let preloadIndex = 0, preloading = false;
    const planner = createWildsEmbodiedAudioPlanner();
    const pause = () => { clearInterval(timer); timer = undefined; planner.reset(); runtime.stopEmbodied(); };
    const start = () => {
      pause();
      if (document.hidden || !active) return;
      // Safari can interrupt an existing context while switching apps. Resume
      // in the background; playable world input never awaits audio.
      void runtime.unlock().catch(() => undefined);
      void loadSamples();
      timer = setInterval(() => {
        const snapshot = embodiedSnapshotRef.current?.();
        if (snapshot) {
          for (const sound of planner.sample(snapshot, performance.now())) runtime.playEmbodied(sound);
          runtime.setEmbodiedAirflow(planner.airflow());
        } else runtime.setEmbodiedAirflow(null);
      }, 125);
    };
    document.addEventListener("visibilitychange", start);
    start();
    async function loadSamples() {
      if (preloading) return;
      preloading = true;
      // One tiny decode per background opportunity, after playable startup.
      try {
        while (active && !document.hidden && preloadIndex < WILDS_EMBODIED_AUDIO_ASSETS.length) {
          await wildzGameplayBackground.run(async () => {
            if (active && !document.hidden) {
              const asset = WILDS_EMBODIED_AUDIO_ASSETS[preloadIndex++];
              await preload([asset]);
            }
          }, { timeoutMs: 2_500 }).catch(() => undefined);
        }
      } finally { preloading = false; }
    }
    return () => { active = false; document.removeEventListener("visibilitychange", start); pause(); };
  }, [audioReady, embodiedEnabled, audioSettings.muted]);

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
    const normalized = normalizeWildsAudioSettings(next);
    audioSettingsRef.current = normalized;
    setAudioSettingsState(normalized);
  }, []);

  const playCue = useCallback((cue: WildsAudioCue) => {
    runtimeRef.current?.play(cue);
  }, []);

  return {
    audioSettings,
    setAudioSettings,
    audioReady,
    unlockAudio,
    playCue,
    visualEvents
  };
}
