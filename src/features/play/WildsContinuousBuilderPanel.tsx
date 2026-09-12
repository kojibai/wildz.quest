"use client";
import { useEffect, useState } from "react";
import { useWildsFloatingPanel } from "./use-wilds-floating-panel";
import { WildsConstructionPieceCatalog, WILDS_BUILD_PIECE_GROUPS as groups } from "./WildsConstructionPieceCatalog";
import { WildsExplainedAction } from "./WildsExplainedAction";
import { Check, GripHorizontal, Lock, Unlock } from "lucide-react";
import { Icons } from "@/components/icons";
import type { useWildsContinuousBuilder } from "./use-wilds-continuous-builder";
import { wildsConstructionCue, wildsConstructionLabel } from "./wilds-continuous-builder";
import { cumulativeWildsConstructionMaterials, wildsConstructionRecipe } from "./wilds-construction-recipes";
import type { WildsConstructionKind } from "./wilds-world-construction";

export function WildsContinuousBuilderPanel({ builder, materials, onOpenCatalogue, onUse }: {
  onOpenCatalogue?: () => void;
  onUse?: (kind: "workshop" | "storage" | "bed") => void;
  builder: ReturnType<typeof useWildsContinuousBuilder>; materials: { hay: number; timber: number; stone: number };
}) {
  const floating=useWildsFloatingPanel();
  const [minimized, setMinimized] = useState(false);
  const [expanded, setExpanded] = useState(false);
  useEffect(()=>{if(builder.dragging)setMinimized(true);},[builder.dragging]);
  useEffect(()=>{if(builder.error)setMinimized(false);},[builder.error]);
  const cost = cumulativeWildsConstructionMaterials(wildsConstructionRecipe(builder.kind), "finished");
  const next = builder.progress?.stages.find(stage => !stage.complete);
  if (minimized) return <button className="wilds-builder-restore" type="button" aria-label="Restore build panel" onClick={() => setMinimized(false)}><Icons.construction size={18} /><span>Build<small>{wildsConstructionLabel(builder.selected?.kind ?? builder.kind)}</small></span></button>;
  return <aside ref={floating.ref} style={floating.style} className={`wilds-continuous-builder${expanded ? " is-expanded" : " is-compact"}`} aria-label="Build with pieces">
    <header><button className="wilds-panel-drag-handle" type="button" aria-label="Move build panel" title="Drag to move; arrow keys to reposition; Home to reset" {...floating.handle}><GripHorizontal size={18}/></button><span><small>Living Construction</small><select aria-label="Choose building piece" value={builder.selected ? "" : builder.kind} onChange={event => { builder.selectKind(event.target.value as WildsConstructionKind); setExpanded(false); }}><option value="" disabled>{builder.selected ? `${wildsConstructionLabel(builder.selected.kind)} · selected` : "Choose a piece"}</option>{groups.map(group => <optgroup key={group.label} label={group.label}>{group.kinds.map(kind => <option key={kind} value={kind}>{wildsConstructionLabel(kind)}</option>)}</optgroup>)}</select></span><button className="wilds-builder-tray-toggle" type="button" aria-expanded={expanded} aria-label={expanded ? "Compact build tray" : "Expand build tray"} onClick={() => setExpanded(value => !value)}>{expanded ? "Less" : "More"}</button><button aria-label="Minimize build panel" type="button" onClick={() => setMinimized(true)}>−</button><button aria-label="Close piece builder" onClick={builder.close} type="button"><Icons.close size={18} /></button></header>
    <div className="wilds-builder-resources" aria-label="Carried building materials">
      <span><Icons.products size={15} /><b>{materials.hay}</b><small>Hay</small></span>
      <span><Icons.timber size={15} /><b>{materials.timber}</b><small>Timber</small></span>
      <span><Icons.quarry size={15} /><b>{materials.stone}</b><small>Stone</small></span>
    </div>
    <div className="wilds-builder-catalog-link">{onOpenCatalogue && <button type="button" onClick={onOpenCatalogue}>Blueprints, tools & storage</button>}<small>{builder.inspecting ? "Tap a piece to inspect it. It stays locked." : "Tap to place. Existing pieces stay locked."}</small></div>
    {!builder.adjusting && <button type="button" aria-pressed={builder.inspecting} onClick={builder.inspecting ? () => builder.selectKind(builder.kind) : builder.editPieces}>{builder.inspecting ? "Back to building" : "Edit placed pieces"}</button>}
    {builder.toggleSnap && <button type="button" aria-pressed={builder.snapEnabled} disabled={Boolean(builder.busy)} onClick={builder.toggleSnap}>
      {builder.snapEnabled ? "Snap to structure · on" : "Free placement · grid"}
    </button>}
    {builder.error && <p className="wilds-builder-error" role="alert">{builder.error}</p>}
    {builder.adjusting ? <section className="wilds-builder-adjustment" aria-label="Adjust placed piece">
      <strong>Adjust {wildsConstructionLabel(builder.selected?.kind ?? builder.kind).toLowerCase()}</strong>
      <p>This piece is unlocked. Drag it to move it.</p>
      <p className="wilds-builder-gesture-help">Drag the piece to move. Sweep its curved handle to rotate; pull its height handle up or down. Release to save and lock.</p>
      {builder.preview && <output className="wilds-builder-adjust-position">X {builder.preview.transform.position.x.toFixed(1)} · Z {builder.preview.transform.position.z.toFixed(1)} · Height {builder.preview.transform.position.y.toFixed(1)} m</output>}
      <p role="status">{builder.busy ? "Saving adjustment…" : builder.adjustBlocker ?? "Fits here. Your materials and progress stay with this piece."}</p>
      <div className="wilds-builder-adjust-actions">
        <button type="button" disabled={Boolean(builder.busy)} onClick={builder.cancelAdjustment}><Lock size={18} /> Lock without changes</button>
        <button type="button" disabled={Boolean(builder.busy) || Boolean(builder.adjustBlocker)} onClick={builder.confirmAdjustment}><Check size={18} />{builder.busy ? "Saving…" : "Save & lock"}</button>
      </div>
    </section> : builder.selected && builder.progress ? <section className="wilds-builder-inspector" aria-label="Selected piece progress">
      <p className="wilds-builder-gesture-help"><Lock size={14} aria-hidden="true" /> Locked in place</p>
      <button type="button" disabled={Boolean(builder.busy)} onClick={builder.beginAdjustment}><Unlock size={18} aria-hidden="true" /> Unlock to adjust</button>
      {builder.maintain && builder.progress.stage !== "planned" && <section aria-label="Weather condition">
        <p>Condition · {builder.condition ? `${builder.condition.integrity}%` : "Not yet inspected"}</p>
        <p>Storms wear exposed pieces. A finished roof protects what is below; stone-rich construction resists wear. Below 50%, repair beds and workshops before use.</p>
        <div className="wilds-builder-actions">
          <button type="button" disabled={Boolean(builder.busy)} onClick={() => builder.maintain(false)}>Check weather condition</button>
          {builder.condition && builder.condition.integrity < 100 && <button type="button" disabled={Boolean(builder.busy)} onClick={() => builder.maintain(true)}>Repair +25 · 1 timber or stone</button>}
        </div>
      </section>}
      <div className="wilds-builder-stages">{["planned", "framed", "functional", "finished"].map(stage => <span key={stage} aria-current={builder.progress?.stage === stage ? "step" : undefined}>{stage}</span>)}</div>
      <progress max={100} value={builder.progress.percentage} aria-label="Construction progress" /><strong>{builder.progress.stage === "planned" ? "Plan placed · add materials to build" : `${builder.progress.percentage}% complete`}</strong>
      {(builder.progress.stage === "functional" || builder.progress.stage === "finished") && (builder.selected.kind === "workshop" || builder.selected.kind === "storage" || builder.selected.kind === "bed") && (builder.selected.kind === "storage" || (builder.condition?.integrity ?? 100) >= 50) && onUse && <button type="button" onClick={() => onUse(builder.selected!.kind as "workshop" | "storage" | "bed")}>{builder.selected.kind === "workshop" ? "Craft tools at this workbench" : builder.selected.kind === "bed" ? "Rest in this bed · recover energy" : "Use this storage"}</button>}
      {next ? <><p>Next: {next.stage}. Add materials and do {next.work.remaining} more work action{next.work.remaining === 1 ? "" : "s"}.</p>
        <div className="wilds-builder-needed">{(["hay", "timber", "stone"] as const).map(kind => <span key={kind}>{kind}<b>{next.materials[kind].contributed}/{next.materials[kind].required}</b></span>)}</div>
        <div className="wilds-builder-actions"><WildsExplainedAction label="Add what I carry" pending={Boolean(builder.busy)} blocker={builder.depositBlocker} onAction={builder.addCarried} /><WildsExplainedAction label={`Build ${next.stage}`} pending={Boolean(builder.busy)} blocker={builder.workBlocker} onAction={builder.work} /></div>
        <p>You do the work yourself. No companion or workbench is required.</p>
      </> : <p>Finished. Choose another piece above to keep building.</p>}
    </section> : builder.inspecting ? <p role="status">Tap the piece you want to edit, or choose it from nearby builds below. Nothing moves until you unlock it.</p> : <section className="wilds-builder-placement" aria-label="Piece placement">
      <strong className="wilds-builder-piece-name">{wildsConstructionLabel(builder.kind)}</strong>
      <p>{builder.preview ? builder.preview.valid ? builder.canPlace ? "This piece fits. Tap the world to place, or use Place below." : "Move closer to place this piece (within 6 metres)." : builder.preview.cues.map(wildsConstructionCue).join(" ") : "Choose a piece and tap to place. Placed pieces lock automatically; select one and unlock to adjust."}</p>
      <p className="wilds-builder-cost">Full build: {cost.hay} hay · {cost.timber} timber · {cost.stone} stone</p>

      {builder.preview && <WildsExplainedAction className="wilds-builder-confirm" label={`Place ${wildsConstructionLabel(builder.kind).toLowerCase()} plan`} pending={Boolean(builder.busy)} blocker={builder.placeBlocker} onAction={builder.place} />}
    </section>}
    {!builder.adjusting && builder.nearbyPieces.length > 0 && <details className="wilds-builder-palette"><summary>Continue nearby builds ({builder.nearbyPieces.length})</summary><section><div>{builder.nearbyPieces.map((piece, index) => <button type="button" key={piece.componentId} onClick={() => builder.selectComponent(piece.componentId)}>{wildsConstructionLabel(piece.kind)} {index + 1}</button>)}</div></section></details>}
    <details hidden={builder.adjusting} open={!builder.selected} className="wilds-builder-palette"><summary>Choose building pieces</summary>
      <WildsConstructionPieceCatalog selected={builder.selected ? undefined : builder.kind} onSelect={kind => { builder.selectKind(kind); setExpanded(false); }} />
    </details>
  </aside>;
}
