"use client";

import { Icons } from "@/components/icons";

export function WildzContextButton({ action, onActivate }: { action: { kind: string; label: string }; onActivate: () => void }) {
  const canEnter = action.kind === "enter";
  return <button
    aria-label={canEnter ? action.label : "No entrance nearby"}
    className={`wildz-context-button${canEnter ? " can-enter" : ""}`}
    disabled={!canEnter}
    onClick={onActivate}
    type="button"
  >
    <span><Icons.door aria-hidden="true" size={24} strokeWidth={2.2} /></span>
  </button>;
}
