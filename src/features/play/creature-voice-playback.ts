"use client";

import type { PortableCardAsset } from "./portable-card";

let sharedAudioContext: AudioContext | null = null;
let activeSource: AudioBufferSourceNode | null = null;

function audioContext() {
  if (sharedAudioContext && sharedAudioContext.state !== "closed") return sharedAudioContext;
  const Constructor = window.AudioContext
    ?? (window as typeof window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!Constructor) throw new Error("creature_voice_audio_unsupported");
  sharedAudioContext = new Constructor();
  return sharedAudioContext;
}

function emitMouth(assetId: string, openness: number) {
  window.dispatchEvent(new CustomEvent("wildz-creature-mouth", {
    detail: { assetId, openness: Math.max(0, Math.min(1, openness)) }
  }));
}

export async function unlockCreatureVoice() {
  if (typeof window === "undefined") return false;
  const context = audioContext();
  if (context.state !== "running") await context.resume();
  return context.state === "running";
}

export function cancelCreatureVoice() {
  if (!activeSource) return;
  try { activeSource.stop(); } catch { /* The source already ended. */ }
  activeSource.disconnect();
  activeSource = null;
}

export async function playCreatureVoice(
  asset: PortableCardAsset,
  dataUrl: string,
  signal: AbortSignal,
  onEnded?: () => void
) {
  if (typeof window === "undefined" || signal.aborted
    || !/^data:audio\/(?:wav|wave|mpeg|mp3|ogg|webm);base64,/i.test(dataUrl)
    || dataUrl.length > 6_000_000) return false;
  try {
    const context = audioContext();
    if (context.state !== "running") await context.resume();
    if (context.state !== "running" || signal.aborted) return false;
    const encoded = dataUrl.slice(dataUrl.indexOf(",") + 1);
    const binary = atob(encoded);
    const bytes = Uint8Array.from(binary, (character) => character.charCodeAt(0));
    const buffer = await context.decodeAudioData(bytes.buffer.slice(0));
    if (signal.aborted) return false;
    cancelCreatureVoice();
    const source = context.createBufferSource();
    const analyser = context.createAnalyser();
    analyser.fftSize = 64;
    analyser.smoothingTimeConstant = .28;
    const waveform = new Uint8Array(analyser.fftSize);
    source.buffer = buffer;
    source.connect(analyser);
    analyser.connect(context.destination);
    activeSource = source;
    let frame = 0;
    const animate = () => {
      analyser.getByteTimeDomainData(waveform);
      const energy = waveform.reduce((sum, sample) => sum + Math.abs(sample - 128), 0) / waveform.length / 34;
      emitMouth(asset.id, Math.max(.04, Math.min(1, energy)));
      frame = requestAnimationFrame(animate);
    };
    const stop = () => {
      if (frame) cancelAnimationFrame(frame);
      emitMouth(asset.id, 0);
    };
    const abort = () => {
      if (activeSource === source) cancelCreatureVoice();
      stop();
    };
    signal.addEventListener("abort", abort, { once: true });
    source.onended = () => {
      signal.removeEventListener("abort", abort);
      stop();
      if (activeSource === source) {
        source.disconnect();
        analyser.disconnect();
        activeSource = null;
      }
      if (!signal.aborted) onEnded?.();
    };
    source.start();
    animate();
    return true;
  } catch {
    return false;
  }
}
