"use client";

import type { CSSProperties } from "react";
import { Icons } from "@/components/icons";
import type { WildsProjectedCapabilityControl } from "./wilds-world-capability-controls";
import type { WildsCapabilityContext } from "./wilds-world-capability-context";
import type { WildsCapabilityIconKey, WildsWorldCapabilityFamily } from "./wilds-world-capability-registry";
import type { WildsAerialMode } from "./wilds-aerial-traversal";

const CAPABILITY_ICONS = {
  flight: Icons.flight,
  glide: Icons.glide,
  swim: Icons.swim,
  dive: Icons.dive,
  current: Icons.current,
  climb: Icons.climb,
  burrow: Icons.burrow,
  balance: Icons.balance,
  light: Icons.light,
  camouflage: Icons.camouflage,
  track: Icons.track,
  break: Icons.break,
  resist: Icons.resist,
  anchor: Icons.anchor,
  rescue: Icons.rescue,
  timber: Icons.timber,
  quarry: Icons.quarry
} satisfies Record<WildsCapabilityIconKey, typeof Icons.flight>;

function fallbackContext(control: WildsProjectedCapabilityControl): WildsCapabilityContext {
  const recovering = !control.runtimeAvailable || control.capacity <= 0;
  return Object.freeze({
    family: control.family,
    state: recovering ? "recovering" as const : "ready" as const,
    candidateIds: Object.freeze([]),
    primaryTargetId: null,
    explanation: recovering ? `${control.label} is recovering with this companion.` : control.action,
    intent: Object.freeze({ kind: recovering ? "explain-recovery" as const : "execute" as const, targetId: null, expectedHead: null })
  });
}

export function WildsCapabilityControls({
  activeAerialMode = "ground",
  controls,
  contexts,
  enabled,
  onRequest
}: Readonly<{
  activeAerialMode?: WildsAerialMode;
  controls: readonly WildsProjectedCapabilityControl[];
  contexts?: ReadonlyMap<WildsWorldCapabilityFamily, WildsCapabilityContext>;
  enabled: boolean;
  onRequest: (family: WildsWorldCapabilityFamily) => void;
}>) {
  return <div className="wilds-capability-controls" aria-label="Companion capabilities">
    {controls.map((control) => {
      const context = contexts?.get(control.family) ?? fallbackContext(control);
      const Icon = CAPABILITY_ICONS[control.icon];
      const explanation = context.explanation.replace(/[.!?]+$/, "");
      const label = control.family === "glide" && control.label !== "Glide" ? `Glide. ${control.label}` : control.label;
      const aerialControl = control.family === "flight" || control.family === "glide";
      const aerialActive = aerialControl && activeAerialMode === control.family;
      return <button
        aria-label={`${label}. ${aerialActive ? "Tap to land" : explanation}. Capacity ${control.capacity} percent`}
        aria-pressed={aerialControl ? aerialActive : undefined}
        className={`wilds-capability-control is-${aerialActive ? "active" : context.state}`}
        disabled={!enabled}
        key={control.family}
        onClick={() => onRequest(control.family)}
        style={{ "--wilds-capability-capacity": `${control.capacity}%` } as CSSProperties}
        title={`${label} · ${control.capacity}%`}
        type="button"
      >
        <Icon aria-hidden="true" size={19} />
        <i aria-hidden="true" />
        <span aria-hidden="true">{control.capacity}</span>
      </button>;
    })}
  </div>;
}
