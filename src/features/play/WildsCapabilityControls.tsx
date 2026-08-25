"use client";

import type { CSSProperties } from "react";
import { Icons } from "@/components/icons";
import type { WildsProjectedCapabilityControl } from "./wilds-world-capability-controls";
import type { WildsCapabilityContext } from "./wilds-world-capability-context";
import type { WildsCapabilityIconKey, WildsWorldCapabilityFamily } from "./wilds-world-capability-registry";

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
  controls,
  contexts,
  enabled,
  onRequest
}: Readonly<{
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
      return <button
        aria-label={`${control.label}. ${explanation}. Capacity ${control.capacity} percent`}
        className={`wilds-capability-control is-${context.state}`}
        disabled={!enabled}
        key={control.family}
        onClick={() => onRequest(control.family)}
        style={{ "--wilds-capability-capacity": `${control.capacity}%` } as CSSProperties}
        title={`${control.label} · ${control.capacity}%`}
        type="button"
      >
        <Icon aria-hidden="true" size={19} />
        <i aria-hidden="true" />
        <span aria-hidden="true">{control.capacity}</span>
      </button>;
    })}
  </div>;
}
