"use client";
import { useState } from "react";
import { WildsConstructionPieceCatalog, WILDS_BUILD_PIECE_GROUPS as groups } from "./WildsConstructionPieceCatalog";
import { WildsExplainedAction } from "./WildsExplainedAction";
import { Icons } from "@/components/icons";
import type { useWildsContinuousBuilder } from "./use-wilds-continuous-builder";
import { wildsConstructionCue, wildsConstructionLabel } from "./wilds-continuous-builder";
import { cumulativeWildsConstructionMaterials, wildsConstructionRecipe } from "./wilds-construction-recipes";
import type { WildsConstructionKind } from "./wilds-world-construction";

export function WildsContinuousBuilderPanel({ builder, materials, onOpenCatalogue, onUse }: {
  onOpenCatalogue?: () => void;
  onUse?: (kind: "workshop" | "storage") => void;
  builder: ReturnType<typeof useWildsContinuousBuilder>; materials: { hay: number; timber: number; stone: number };
}) {
  const [minimized, setMinimized] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const cost = cumulativeWildsConstructionMaterials(wildsConstructionRecipe(builder.kind), "finished");
  const next = builder.progress?.stages.find(stage => !stage.complete);
  if (minimized) return <button className="wilds-builder-restore" type="button" aria-label="Restore build panel" onClick={() => setMinimized(false)}><Icons.construction size={18} /><span>Build<small>{wildsConstructionLabel(builder.selected?.kind ?? builder.kind)}</small></span></button>;
  return <aside className={`wilds-continuous-builder${expanded ? " is-expanded" : " is-compact"}`} aria-label="Build with pieces">
    <header><span><small>Living Construction</small><select aria-label="Choose building piece" value={builder.selected ? "" : builder.kind} onChange={event => { builder.selectKind(event.target.value as WildsConstructionKind); setExpanded(false); }}><option value="" disabled>{builder.selected ? `${wildsConstructionLabel(builder.selected.kind)} · selected` : "Choose a piece"}</option>{groups.map(group => <optgroup key={group.label} label={group.label}>{group.kinds.map(kind => <option key={kind} value={kind}>{wildsConstructionLabel(kind)}</option>)}</optgroup>)}</select></span><button className="wilds-builder-tray-toggle" type="button" aria-expanded={expanded} aria-label={expanded ? "Compact build tray" : "Expand build tray"} onClick={() => setExpanded(value => !value)}>{expanded ? "Less" : "More"}</button><button aria-label="Minimize build panel" type="button" onClick={() => setMinimized(true)}>−</button><button aria-label="Close piece builder" onClick={builder.close} type="button"><Icons.close size={18} /></button></header>
    <div className="wilds-builder-resources" aria-label="Carried building materials">
      <span><Icons.products size={15} /><b>{materials.hay}</b><small>Hay</small></span>
      <span><Icons.timber size={15} /><b>{materials.timber}</b><small>Timber</small></span>
      <span><Icons.quarry size={15} /><b>{materials.stone}</b><small>Stone</small></span>
    </div>
    <div className="wilds-builder-catalog-link">{onOpenCatalogue && <button type="button" onClick={onOpenCatalogue}>Blueprints, tools & storage</button>}<small>Keep this tray open and tap the world to place or select.</small></div>
    {builder.error && <p className="wilds-builder-error" role="alert">{builder.error}</p>}
    {builder.selected && builder.progress ? <section className="wilds-builder-inspector" aria-label="Selected piece progress">
      <div className="wilds-builder-stages">{["planned", "framed", "functional", "finished"].map(stage => <span key={stage} aria-current={builder.progress?.stage === stage ? "step" : undefined}>{stage}</span>)}</div>
      <progress max={100} value={builder.progress.percentage} aria-label="Construction progress" /><strong>{builder.progress.stage === "planned" ? "Plan placed · add materials to build" : `${builder.progress.percentage}% complete`}</strong>
      {(builder.progress.stage === "functional" || builder.progress.stage === "finished") && (builder.selected.kind === "workshop" || builder.selected.kind === "storage") && onUse && <button type="button" onClick={() => onUse(builder.selected!.kind as "workshop" | "storage")}>{builder.selected.kind === "workshop" ? "Craft tools at this workbench" : "Use this storage"}</button>}
      {next ? <><p>Next: {next.stage}. Add materials and do {next.work.remaining} more work action{next.work.remaining === 1 ? "" : "s"}.</p>
        <div className="wilds-builder-needed">{(["hay", "timber", "stone"] as const).map(kind => <span key={kind}>{kind}<b>{next.materials[kind].contributed}/{next.materials[kind].required}</b></span>)}</div>
        <div className="wilds-builder-actions"><WildsExplainedAction label="Add what I carry" pending={Boolean(builder.busy)} blocker={builder.depositBlocker} onAction={builder.addCarried} /><WildsExplainedAction label={`Build ${next.stage}`} pending={Boolean(builder.busy)} blocker={builder.workBlocker} onAction={builder.work} /></div>
        <p>You do the work yourself. No companion or workbench is required.</p>
      </> : <p>Finished. Choose another piece above to keep building.</p>}
    </section> : <section className="wilds-builder-placement" aria-label="Piece placement">
      <strong className="wilds-builder-piece-name">{wildsConstructionLabel(builder.kind)}</strong>
      <p>{builder.preview ? builder.preview.valid ? builder.canPlace ? "This piece fits. Tap the world to place, or use Place below." : "Move closer to place this piece (within 6 metres)." : builder.preview.cues.map(wildsConstructionCue).join(" ") : "Select a piece above, then tap the world to place its plan. Use Continue nearby builds to work on an existing piece."}</p>
      <p className="wilds-builder-cost">Full build: {cost.hay} hay · {cost.timber} timber · {cost.stone} stone</p>
      <div className="wilds-builder-transforms"><button type="button" onClick={builder.rotate}>Rotate {builder.rotation * 90}°</button><button aria-label="Lower piece" type="button" onClick={builder.lower}>−</button><span>{builder.height * .5} m</span><button aria-label="Raise piece" type="button" onClick={builder.raise}>+</button><button aria-label="Clear placement preview" type="button" onClick={builder.undoPreview}>Reset</button></div>
      {builder.preview && <WildsExplainedAction className="wilds-builder-confirm" label={`Place ${wildsConstructionLabel(builder.kind).toLowerCase()} plan`} pending={Boolean(builder.busy)} blocker={builder.placeBlocker} onAction={builder.place} />}
    </section>}
    {builder.nearbyPieces.length > 0 && <details className="wilds-builder-palette"><summary>Continue nearby builds ({builder.nearbyPieces.length})</summary><section><div>{builder.nearbyPieces.map((piece, index) => <button type="button" key={piece.componentId} onClick={() => builder.selectComponent(piece.componentId)}>{wildsConstructionLabel(piece.kind)} {index + 1}</button>)}</div></section></details>}
    <details open={!builder.selected} className="wilds-builder-palette"><summary>Choose building pieces</summary>
      <WildsConstructionPieceCatalog selected={builder.selected ? undefined : builder.kind} onSelect={kind => { builder.selectKind(kind); setExpanded(false); }} />
    </details>
  </aside>;
}
