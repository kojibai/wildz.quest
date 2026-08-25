"use client";

import { Icons } from "@/components/icons";
import type { WildsStewardPlacement } from "./wilds-steward-craft";

export function WildsStewardPlacementHud({ blueprintLabel, partnerName, pending, preview, onCancel, onConfirm }: {
  blueprintLabel: string;
  partnerName: string;
  pending: boolean;
  preview: WildsStewardPlacement;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  const progressiveSite = blueprintLabel === "Trail Shelter" || blueprintLabel === "Trail Bridge";
  return <aside className={`wilds-steward-placement-hud${preview.valid ? " is-valid" : " is-invalid"}`} aria-label={`${blueprintLabel} placement preview`}>
    <div className="wilds-steward-placement-copy">
      <span aria-hidden="true"><Icons.check size={18} /></span>
      <div><small>{preview.valid ? "Physical place found" : "Place not admitted"}</small><strong>{blueprintLabel}</strong><em>{preview.reason ?? (progressiveSite ? "Mark this living place now; exact materials and shared work follow." : `${partnerName} is ready to build here.`)}</em></div>
    </div>
    <div className="wilds-steward-placement-actions">
      <button aria-label="Cancel placement" disabled={pending} onClick={onCancel} type="button"><Icons.close size={17} /><span>Cancel</span></button>
      <button aria-label={progressiveSite ? `Place ${blueprintLabel} site` : `Confirm build with ${partnerName}`} disabled={!preview.valid || pending} onClick={onConfirm} type="button"><Icons.check size={17} /><span>{pending ? "Admitting…" : progressiveSite ? "Place site" : "Confirm build"}</span></button>
    </div>
  </aside>;
}
