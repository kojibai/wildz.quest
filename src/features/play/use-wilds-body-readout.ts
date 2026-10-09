"use client";
import { useEffect, useState } from 'react';
import { observeWildsKaiUPulse } from './wilds-kai-runtime';
import { playerBreathReadout, projectPlayerBreathState, type PlayerBreaths } from './player-breath-energy';
import { startWildsVisibleDisplayClock } from './wilds-visible-display-clock';

/** Display time advances analytically; it never writes a player checkpoint. */
export type WildsBodyReadoutSource = { energy: number; playerBreaths?: PlayerBreaths };
export type WildsBodyReadoutInput = WildsBodyReadoutSource | (() => WildsBodyReadoutSource | undefined);
export function useWildsBodyReadout(source?: WildsBodyReadoutInput) {
  const [kai, setKai] = useState(() => observeWildsKaiUPulse());
  const enabled = Boolean(source);
  useEffect(() => {
    if (!enabled) return;
    const update = () => setKai(observeWildsKaiUPulse());
    const clock = startWildsVisibleDisplayClock({ hidden: () => document.hidden, read: update,
      schedule: tick => window.setTimeout(tick, 1000), cancel: timer => window.clearTimeout(timer) });
    document.addEventListener('visibilitychange', clock.visibilityChanged);
    return () => { clock.dispose(); document.removeEventListener('visibilitychange', clock.visibilityChanged); };
  }, [enabled]);
  const current = typeof source === 'function' ? source() : source;
  return current ? playerBreathReadout(projectPlayerBreathState(current, kai).playerBreaths) : null;
}
