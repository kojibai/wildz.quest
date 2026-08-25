"use client";

import { Icons } from "@/components/icons";
import type { projectWildsStewardCraft, WildsStewardBlueprintId } from "./wilds-steward-craft";
import type { WildsStewardToolKind, WildsStewardToolV1 } from "./wilds-steward-construction";

type Projection = ReturnType<typeof projectWildsStewardCraft>;

export function WildsStewardCraftPanel({ projection, onSelectBlueprint, tools = [], equippedToolId = null, nearbyWorkbench = false, nearbyCache = false, stored = { timber: 0, stone: 0 }, onCraftTool, onEquipTool, onStoreMaterial, onWithdrawMaterial }: {
  projection: Projection;
  onSelectBlueprint: (blueprintId: WildsStewardBlueprintId) => void;
  tools?: readonly WildsStewardToolV1[];
  equippedToolId?: string | null;
  nearbyWorkbench?: boolean;
  nearbyCache?: boolean;
  stored?: Readonly<{ timber: number; stone: number }>;
  onCraftTool?: (kind: WildsStewardToolKind) => void;
  onEquipTool?: (toolId: string) => void;
  onStoreMaterial?: (kind: "timber" | "stone") => void;
  onWithdrawMaterial?: (kind: "timber" | "stone") => void;
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
            <span className="wilds-steward-blueprint-icon" aria-hidden="true">{blueprint.id === "trail-shelter" ? <Icons.camp size={21} /> : <Icons.box size={21} />}</span>
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
    <section className="wilds-steward-workshop" aria-label="Field tools and trail storage">
      <header><span><small>Physical capability</small><strong>Field tools</strong></span><em>{nearbyWorkbench ? "Workbench in reach" : "Build or approach your workbench"}</em></header>
      <div className="wilds-steward-tool-grid">
        {([{"kind":"steward-axe","label":"Steward Axe","cost":"1 timber · 1 stone","family":"Woodland"},{"kind":"quarry-pick","label":"Quarry Pick","cost":"1 timber · 2 stone","family":"Quarry"}] as const).map((definition) => {
          const existing = tools.find((tool) => tool.kind === definition.kind);
          return <article key={definition.kind}>
            <span><strong>{definition.label}</strong><small>{definition.family} precision · {definition.cost}</small></span>
            {existing ? <><meter max={existing.durability.capacity} min={0} value={existing.durability.remaining} /><button disabled={equippedToolId === existing.toolId} onClick={() => onEquipTool?.(existing.toolId)} type="button">{equippedToolId === existing.toolId ? `Equipped · ${existing.durability.remaining}/24` : `Equip · ${existing.durability.remaining}/24`}</button></>
              : <button disabled={!nearbyWorkbench || projection.partner.ready === false} onClick={() => onCraftTool?.(definition.kind)} type="button">{nearbyWorkbench ? `Craft ${definition.label}` : "Workbench required"}</button>}
          </article>;
        })}
      </div>
      <div className="wilds-steward-cache">
        <span><small>Trail cache</small><strong>{nearbyCache ? `${stored.timber} timber · ${stored.stone} stone stored` : "Approach your cache"}</strong></span>
        <div>{(["timber", "stone"] as const).map((kind) => <span key={kind}><button disabled={!nearbyCache || projection.materials[kind] < 1} onClick={() => onStoreMaterial?.(kind)} type="button">Store {kind}</button><button disabled={!nearbyCache || stored[kind] < 1} onClick={() => onWithdrawMaterial?.(kind)} type="button">Take {kind}</button></span>)}</div>
      </div>
    </section>
    <p className="wilds-satchel-note">A blueprint is only a possibility. Exact lots move once, after you preview a physical place and confirm the work.</p>
  </section>;
}
