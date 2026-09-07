"use client";

import { useEffect, useRef } from "react";
import { WildsConstructionPieceCatalog } from "./WildsConstructionPieceCatalog";
import type { WildsConstructionKind } from "./wilds-world-construction";
import { WildsExplainedAction } from "./WildsExplainedAction";
import { missingBuildMaterials, gatherBuildGuidance } from "./wilds-build-guidance";
import { Icons } from "@/components/icons";
import type { projectWildsStewardCraft, WildsStewardBlueprintId } from "./wilds-steward-craft";
import type { WildsStewardToolKind, WildsStewardToolV1 } from "./wilds-steward-construction";
import type { WildsConstructionSiteV1 } from "./wilds-construction-site";

type Projection = ReturnType<typeof projectWildsStewardCraft>;

export function WildsStewardCraftPanel({ projection, onSelectBlueprint, onSelectPiece, focusSection, nearbySite = null, siteDistance = 0, tools = [], equippedToolId = null, nearbyWorkbench = false, nearbyCache = false, stored = { timber: 0, stone: 0 }, onContributeSite, onWorkSite, onCraftTool, onEquipTool, onStoreMaterial, onWithdrawMaterial }: {
  projection: Projection;
  onSelectPiece?: (kind: WildsConstructionKind) => void;
  focusSection?: "tools" | "storage" | null;
  onSelectBlueprint: (blueprintId: WildsStewardBlueprintId) => void;
  siteDistance?: number;
  nearbySite?: WildsConstructionSiteV1 | null;
  tools?: readonly WildsStewardToolV1[];
  equippedToolId?: string | null;
  nearbyWorkbench?: boolean;
  nearbyCache?: boolean;
  stored?: Readonly<{ timber: number; stone: number }>;
  onCraftTool?: (kind: WildsStewardToolKind) => void;
  onEquipTool?: (toolId: string) => void;
  onStoreMaterial?: (kind: "timber" | "stone") => void;
  onWithdrawMaterial?: (kind: "timber" | "stone") => void;
  onContributeSite?: (site: WildsConstructionSiteV1) => void;
  onWorkSite?: (site: WildsConstructionSiteV1) => void;
}) {
  const toolsRef = useRef<HTMLElement>(null);
  const storageRef = useRef<HTMLDivElement>(null);
  useEffect(() => { if (focusSection) (focusSection === "storage" ? storageRef.current : toolsRef.current)?.scrollIntoView({ block: "start" }); }, [focusSection]);
  return <section className="wilds-steward-craft" aria-label="Steward Craft">
    <header className="wilds-steward-craft-header">
      <span><small>Living construction</small><strong>Build, furnish & expand</strong></span>
      <div className="wilds-steward-material-bank" aria-label={`${projection.materials.hay} hay, ${projection.materials.timber} timber, and ${projection.materials.stone} stone available`}>
        <span><Icons.products aria-hidden="true" size={16} /><b>{projection.materials.hay}</b><small>Living hay</small></span>
        <span><Icons.timber aria-hidden="true" size={16} /><b>{projection.materials.timber}</b></span>
        <span><Icons.quarry aria-hidden="true" size={16} /><b>{projection.materials.stone}</b></span>
      </div>
    </header>
    {nearbySite ? <ConstructionSiteCard onContribute={onContributeSite} onWork={onWorkSite} pending={projection.pending} site={nearbySite} distance={siteDistance} materials={projection.materials} /> : null}
    <p className="wilds-satchel-note">You can build these yourself. A workbench costs 3 timber + 2 stone and only unlocks crafting an axe or pick. Shelters, walls, stairs and roofs need no workbench or companion. Choose a piece below to extend your place using the same satchel.</p>
    <div className="wilds-steward-craft-catalog" aria-label="Known construction blueprints">
      {projection.blueprints.map((blueprint) => {
        const missing = missingBuildMaterials(blueprint.materials, projection.materials);
        const blocker = missing ? gatherBuildGuidance(missing) : null;
        return <article className={`wilds-steward-blueprint is-${blueprint.state}${blueprint.selected ? " is-selected" : ""}`} key={blueprint.id}>
          <div>
            <span className="wilds-steward-blueprint-icon" aria-hidden="true">{blueprint.id === "trail-shelter" ? <Icons.camp size={21} /> : <Icons.box size={21} />}</span>
            <span><strong>{blueprint.label}</strong><small>{blueprint.placement}</small></span>
          </div>
          <p>{blueprint.purpose}</p>
          <footer>
            <span><Icons.timber aria-hidden="true" size={13} />{blueprint.materials.timber}</span>
            <span><Icons.quarry aria-hidden="true" size={13} />{blueprint.materials.stone}</span>
            <WildsExplainedAction label={`Place ${blueprint.label}`} blocker={blocker} pending={projection.pending} onAction={() => onSelectBlueprint(blueprint.id)} />
          </footer>
        </article>;
      })}
    </div>
    {onSelectPiece && <section className="wilds-living-piece-section"><h3>Add to your place</h3><p>Start with a foundation or floor, then add walls, stairs and a roof. Workbenches and storage become usable at their functional stage.</p><WildsConstructionPieceCatalog onSelect={onSelectPiece} /></section>}
    <section ref={toolsRef} className="wilds-steward-workshop" aria-label="Field tools and trail storage">
      <header><span><small>Physical capability</small><strong>Field tools</strong></span><em>{nearbyWorkbench ? "Workbench in reach" : "Build or approach your workbench"}</em></header>
      <div className="wilds-steward-tool-grid">
        {([{"kind":"steward-axe","label":"Steward Axe","cost":"1 timber · 1 stone","family":"Woodland"},{"kind":"quarry-pick","label":"Quarry Pick","cost":"1 timber · 2 stone","family":"Quarry"}] as const).map((definition) => {
          const missing = missingBuildMaterials({ timber: 1, stone: definition.kind === "steward-axe" ? 1 : 2 }, projection.materials);
          const blocker = !nearbyWorkbench ? "Place a Steward Workbench above using 3 timber + 2 stone, then stand within 6 metres. A Workbench piece also works once its functional stage is built." : missing ? gatherBuildGuidance(missing) : null;
          const existing = tools.find((tool) => tool.kind === definition.kind);
          return <article key={definition.kind}>
            <span><strong>{definition.label}</strong><small>{definition.family} precision · {definition.cost}</small></span>
            {existing ? <><meter max={existing.durability.capacity} min={0} value={existing.durability.remaining} /><button disabled={equippedToolId === existing.toolId} onClick={() => onEquipTool?.(existing.toolId)} type="button">{equippedToolId === existing.toolId ? `Equipped · ${existing.durability.remaining}/24` : `Equip · ${existing.durability.remaining}/24`}</button></>
              : <WildsExplainedAction label={`Craft ${definition.label}`} blocker={blocker} pending={projection.pending} onAction={() => onCraftTool?.(definition.kind)} />}
          </article>;
        })}
      </div>
      <div ref={storageRef} className="wilds-steward-cache">
        <span><small>Trail cache</small><strong>{nearbyCache ? `${stored.timber} timber · ${stored.stone} stone stored` : "Approach your cache"}</strong></span>
        <div>{(["timber", "stone"] as const).map((kind) => <span key={kind}><WildsExplainedAction label={`Store ${kind}`} pending={projection.pending} blocker={!nearbyCache ? "Build a Trail Cache above and stand within 6 metres of it." : projection.materials[kind] < 1 ? `You carry no ${kind}. Gather some first, then store it here.` : null} onAction={() => onStoreMaterial?.(kind)} /><WildsExplainedAction label={`Take ${kind}`} pending={projection.pending} blocker={!nearbyCache ? "Stand within 6 metres of your Trail Cache." : stored[kind] < 1 ? `This cache contains no ${kind}. Gather some to build or store.` : null} onAction={() => onWithdrawMaterial?.(kind)} /></span>)}</div>
      </div>
    </section>
    <p className="wilds-satchel-note">Previewing moves nothing. Confirming a site reserves every exact material shown by its blueprint.</p>
  </section>;
}

function ConstructionSiteCard({ site, pending, onContribute, onWork, distance, materials }: {
  site: WildsConstructionSiteV1;
  distance: number;
  materials: { timber: number; stone: number };
  pending: boolean;
  onContribute?: (site: WildsConstructionSiteV1) => void;
  onWork?: (site: WildsConstructionSiteV1) => void;
}) {
  const timber = site.contributedLots.filter((entry) => entry.kind === "timber").length;
  const stone = site.contributedLots.filter((entry) => entry.kind === "stone").length;
  const need = { timber: Math.max(0, site.materialsRequired.timber - timber), stone: Math.max(0, site.materialsRequired.stone - stone) };
  const canContribute = (need.timber > 0 && materials.timber > 0) || (need.stone > 0 && materials.stone > 0);
  const blocker = distance > 6 ? `You are ${distance.toFixed(1)} metres away. Move within 6 metres of this site.` : site.stage === "complete" ? "This build is finished. Open Build with pieces to add walls, stairs and roofs." : site.stage !== "materials-ready" && !canContribute ? gatherBuildGuidance(missingBuildMaterials(need, {})) : null;
  const total = site.materialsRequired.timber + site.materialsRequired.stone + site.workRequired;
  const complete = timber + stone + site.workCompleted;
  return <section className={`wilds-construction-site-card is-${site.stage}`} aria-label={`Nearby ${site.blueprint.replace("trail-", "trail ")} construction site`}>
    <header><span><small>{distance <= 6 ? "In reach" : "Move closer"} · shared site</small><strong>{site.blueprint === "trail-shelter" ? "Trail Shelter" : "Trail Bridge"}</strong></span><em>{Math.round(complete / total * 100)}%</em></header>
    <div className="wilds-construction-site-progress" aria-label={`${complete} of ${total} construction steps complete`} aria-valuemax={total} aria-valuemin={0} aria-valuenow={complete} role="meter"><i style={{ width: `${complete / total * 100}%` }} /></div>
    <div className="wilds-construction-site-ledger"><span><Icons.timber size={14} /> Timber <b>{timber}/{site.materialsRequired.timber}</b></span><span><Icons.quarry size={14} /> Stone <b>{stone}/{site.materialsRequired.stone}</b></span></div>
    <p>{site.stage === "materials-ready" ? "All materials are already at this site. Tap Finish to build it yourself. No workbench, companion or other player is required." : "Contributed lots remain here for every steward to see. Bring any material still missing."}</p>
    <WildsExplainedAction pending={pending} blocker={blocker} label={site.stage === "materials-ready" ? (site.blueprint === "trail-shelter" ? "Finish shelter" : "Finish bridge") : "Contribute what I carry"} onAction={() => site.stage === "materials-ready" ? onWork?.(site) : onContribute?.(site)} />
  </section>;
}
