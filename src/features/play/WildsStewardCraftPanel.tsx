"use client";

import { Icons } from "@/components/icons";
import type { projectWildsStewardCraft, WildsStewardBlueprintId } from "./wilds-steward-craft";

type Projection = ReturnType<typeof projectWildsStewardCraft>;

export function WildsStewardCraftPanel({ projection, onSelectBlueprint }: {
  projection: Projection;
  onSelectBlueprint: (blueprintId: WildsStewardBlueprintId) => void;
}) {
  return <section className="wilds-steward-craft" aria-label="Steward Craft">
    <header className="wilds-steward-craft-header">
      <span><small>Living construction</small><strong>Steward Craft</strong></span>
      <div className="wilds-steward-material-bank" aria-label={`${projection.materials.timber} timber and ${projection.materials.stone} stone available`}>
        <span><Icons.timber aria-hidden="true" size={16} /><b>{projection.materials.timber}</b></span>
        <span><Icons.quarry aria-hidden="true" size={16} /><b>{projection.materials.stone}</b></span>
      </div>
    </header>
    <div className={`wilds-steward-partner${projection.partner.ready ? " is-ready" : " is-recovering"}`}>
      <span><small>Assigned partner</small><strong>{projection.partner.name}</strong></span>
      <div aria-label={`${projection.partner.capacity} percent work capacity`} aria-valuemax={100} aria-valuemin={0} aria-valuenow={projection.partner.capacity} role="meter">
        <i style={{ width: `${projection.partner.capacity}%` }} />
      </div>
      <em>{projection.partner.families.join(" · ") || "Rest before working"}</em>
    </div>
    <div className="wilds-steward-craft-catalog" aria-label="Known construction blueprints">
      {projection.blueprints.map((blueprint) => {
        const disabled = blueprint.state !== "ready";
        const status = blueprint.state === "pending" ? "World command in progress"
          : blueprint.state === "partner" ? "Partner needs recovery"
            : blueprint.state === "materials" ? `Need ${blueprint.missing.timber} timber · ${blueprint.missing.stone} stone`
              : "Ready to place";
        return <article className={`wilds-steward-blueprint is-${blueprint.state}${blueprint.selected ? " is-selected" : ""}`} key={blueprint.id}>
          <div>
            <span className="wilds-steward-blueprint-icon" aria-hidden="true">{blueprint.id === "trail-bridge" ? <Icons.box size={21} /> : <Icons.camp size={21} />}</span>
            <span><strong>{blueprint.label}</strong><small>{blueprint.placement}</small></span>
          </div>
          <p>{blueprint.purpose}</p>
          <footer>
            <span><Icons.timber aria-hidden="true" size={13} />{blueprint.materials.timber}</span>
            <span><Icons.quarry aria-hidden="true" size={13} />{blueprint.materials.stone}</span>
            <button aria-label={`${status}. Select ${blueprint.label}`} disabled={disabled} onClick={() => onSelectBlueprint(blueprint.id)} type="button">{status}</button>
          </footer>
        </article>;
      })}
    </div>
    <p className="wilds-satchel-note">A blueprint is only a possibility. Exact lots move once, after you preview a physical place and confirm the work.</p>
  </section>;
}
