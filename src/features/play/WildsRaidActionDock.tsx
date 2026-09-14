"use client";

import type { WildsRaidIntent } from "./wilds-raid-encounter";
import type { WildsRaidCardRole } from "./wilds-raid-roles";

const fighterActions: readonly WildsRaidIntent["type"][] = ["strike", "guard", "focus", "interrupt", "ability", "revive"];
// Support is a placement/queue, not a damage lock. A shared boss must remain
// attackable when all fighter squads are occupied; support players can strike
// while still contributing their support tools.
const supportActions: readonly WildsRaidIntent["type"][] = ["strike", "stabilize", "scout", "supply", "rescue", "rotate_request"];

const actionGlyph: Record<WildsRaidIntent["type"], string> = {
  strike: "✦", guard: "◇", focus: "◎", interrupt: "⚡", ability: "◆", revive: "+",
  stabilize: "△", scout: "⌁", supply: "▣", rescue: "↟", ward: "◈", rotate_request: "↻", retreat: "←"
};

export function WildsRaidActionDock({ placement, role, busyIntent, disabled, onAction }: {
  placement: "fighter" | "support";
  role: WildsRaidCardRole;
  busyIntent?: WildsRaidIntent["type"] | null;
  disabled?: boolean;
  onAction: (intent: WildsRaidIntent["type"]) => void;
}) {
  const actions = placement === "fighter" ? fighterActions : supportActions;
  return (
    <div aria-label={`${role} raid actions`} className="wilds-raid-action-dock" role="toolbar">
      {actions.map((intent) => (
        <button
          aria-label={intent.replaceAll("_", " ")}
          className="wilds-raid-action"
          data-intent={intent}
          disabled={disabled || Boolean(busyIntent)}
          key={intent}
          onClick={() => onAction(intent)}
          type="button"
        >
          <span aria-hidden="true">{busyIntent === intent ? "···" : actionGlyph[intent]}</span>
          <small>{intent.replaceAll("_", " ")}</small>
        </button>
      ))}
    </div>
  );
}
