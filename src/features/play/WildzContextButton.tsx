"use client";

import { Icons } from "@/components/icons";

export function WildzContextButton({ action, onActivate }: { action: { kind: string; label: string }; onActivate: () => void }) {
  const ActionIcon = action.kind === "search" ? Icons.search : action.kind === "enter" ? Icons.enter : action.kind === "greet" ? Icons.users : Icons.walk;
  return <button className={`wildz-context-button action-${action.kind}`} onClick={onActivate} aria-label={action.label} type="button">
    <span><ActionIcon aria-hidden="true" size={26} strokeWidth={2.4} /></span>
  </button>;
}
