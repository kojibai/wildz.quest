"use client";

import { useCallback, useState } from "react";
import { WildsPopoverSurface } from "./WildsPopoverSurface";

import type { WildsAudioSettings as WildsAudioSettingsValue } from "@/features/play/wilds-audio";

const volumeControls = [
  ["master", "Master volume"],
  ["effects", "Effects volume"],
  ["ambience", "Ambience volume"],
  ["music", "Music volume"]
] as const;

export function WildsAudioSettings({
  settings,
  ready,
  onChange,
  onUnlock
}: {
  settings: WildsAudioSettingsValue;
  ready: boolean;
  onChange: (settings: WildsAudioSettingsValue) => void;
  onUnlock: () => void;
}) {
  const [open, setOpen] = useState(false);
  const close = useCallback(() => setOpen(false), []);
  return (
    <div className="wilds-audio-settings">
      <button aria-expanded={open} aria-label="Wilds audio settings" onClick={() => { onUnlock(); setOpen((value) => !value); }} title="Audio settings" type="button">
        <svg aria-hidden="true" viewBox="0 0 24 24">
          <path d="M4 9v6h4l5 4V5L8 9H4Z" />
          <path d="M16 8.2a5 5 0 0 1 0 7.6M18.7 5.5a9 9 0 0 1 0 13" />
        </svg>
      </button>
      {open ? <WildsPopoverSurface ariaLabel="Wilds audio settings" className="wilds-audio-sheet" header={<div className="wilds-audio-sheet-head"><span><strong>Wilds sound</strong><small aria-live="polite">{ready ? "Sound ready" : "Tap world for sound"}</small></span><button aria-label="Close Wilds audio settings" autoFocus onClick={close} type="button">×</button></div>} onClose={close}>
        {volumeControls.map(([key, label]) => (
          <label key={key}>
            <span>{label}</span>
            <output>{Math.round(settings[key] * 100)}%</output>
            <input
              aria-label={label}
              max="1"
              min="0"
              onChange={(event) => onChange({ ...settings, [key]: Number(event.currentTarget.value) })}
              step="0.05"
              type="range"
              value={settings[key]}
            />
          </label>
        ))}
        <label className="wilds-audio-mute">
          <input
            checked={settings.muted}
            onChange={(event) => onChange({ ...settings, muted: event.currentTarget.checked })}
            type="checkbox"
          />
          <span>Mute Wilds audio</span>
        </label>
      </WildsPopoverSurface> : null}
    </div>
  );
}
