"use client";
import type { PortableCardAsset } from "./portable-card";
import type { WildsCrewMode } from "./wilds-crew-preferences";
import { WildsCrewTravelJournal, type WildsCrewTravelHistory } from "./WildsCrewTravelJournal";

/** Both Vault and the HUD issue commands to the campaign's expedition controller. */
export function WildsCrewCreatureControls({ card, mode, accompanying, report, disabled = false, onModeChange, readHistory }: {
  card: PortableCardAsset;
  mode?: WildsCrewMode;
  accompanying: boolean;
  report?: string;
  disabled?: boolean;
  onModeChange: (assetId: string, mode: WildsCrewMode) => void;
  readHistory?: WildsCrewTravelHistory;
}) {
  return <fieldset style={{ border: "1px solid rgba(255,255,255,.18)", borderRadius: 12, padding: 12 }}>
    <legend>{card.manifest.name} · Trail exploration</legend>
    <div role="group" aria-label={`${card.manifest.name} movement`} style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
      {(["follow", "roam"] as const).map(value => <button key={value} disabled={disabled} type="button" aria-pressed={mode === value}
        onClick={() => onModeChange(card.id, value)} style={{ padding: "10px 16px", borderRadius: 8, border: "1px solid currentColor", background: mode === value ? "rgba(94,234,212,.2)" : "transparent", color: "inherit" }}>
        {value === "follow" ? "Follow / recall" : "Roam & explore"}
      </button>)}
    </div>
    <small role="status">{report ?? (disabled ? "This creature’s living journey has ended." : mode === "roam" ? "Preparing this creature’s exploration journey." : !accompanying ? "Ready to set out from your location." : mode === "follow" ? "Follow selected. This companion returns when the path is clear." : "Using this creature’s usual companion behavior.")}</small>
    {readHistory ? <WildsCrewTravelJournal key={`${card.manifest.ownerReceizId}:${card.id}:${card.proof.digest}`} assetId={card.id} name={card.manifest.name} readHistory={readHistory} /> : null}
  </fieldset>;
}
