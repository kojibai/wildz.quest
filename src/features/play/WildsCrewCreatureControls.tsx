"use client";
import { Icons } from "@/components/icons";
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
  return <fieldset className="wilds-expedition-card">
    <legend><span className="wilds-expedition-emblem"><Icons.roam size={22} aria-hidden="true" /></span><span><small>Trail companion</small><strong>{card.manifest.name}</strong></span></legend>
    <div role="group" aria-label={`${card.manifest.name} movement`} className="wilds-expedition-actions">
      {(["follow", "roam"] as const).map(value => <button key={value} disabled={disabled} type="button" aria-pressed={mode === value}
        onClick={() => onModeChange(card.id, value)}>
        {value === "follow" ? <Icons.home size={17} aria-hidden="true" /> : <Icons.map size={17} aria-hidden="true" />}
        <span>{value === "follow" ? "Follow / recall" : "Roam & explore"}</span>
      </button>)}
    </div>
    <small className="wilds-expedition-status" role="status"><i aria-hidden="true" />{report ?? (disabled ? "This creature’s living journey has ended." : mode === "roam" ? "Preparing this creature’s exploration journey." : !accompanying ? "Ready to set out from your location." : mode === "follow" ? "Returning to travel beside you." : "Travelling beside you.")}</small>
    {readHistory ? <WildsCrewTravelJournal key={`${card.manifest.ownerReceizId}:${card.id}:${card.proof.digest}`} assetId={card.id} name={card.manifest.name} readHistory={readHistory} /> : null}
  </fieldset>;
}
