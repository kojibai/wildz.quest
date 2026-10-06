"use client";
import { useEffect, useState } from 'react';
import { observeWildsKaiUPulse } from './wilds-kai-runtime';
import { playerBreathReadout, projectPlayerBreathState, type PlayerBreaths } from './player-breath-energy';

/** Display time advances analytically; it never writes a player checkpoint. */
export type WildsBodyReadoutSource = { energy: number; playerBreaths?: PlayerBreaths };
export type WildsBodyReadoutInput = WildsBodyReadoutSource | (() => WildsBodyReadoutSource | undefined);
export function useWildsBodyReadout(source?: WildsBodyReadoutInput) {
  const [kai, setKai] = useState(() => observeWildsKaiUPulse());
  const enabled = Boolean(source);
  useEffect(() => {
    if (!enabled) return;
    const update = () => setKai(observeWildsKaiUPulse());
    update();
    const timer = window.setInterval(update, 1000);
    document.addEventListener('visibilitychange', update);
    return () => { window.clearInterval(timer); document.removeEventListener('visibilitychange', update); };
  }, [enabled]);
  const current = typeof source === 'function' ? source() : source;
  return current ? playerBreathReadout(projectPlayerBreathState(current, kai).playerBreaths) : null;
}
