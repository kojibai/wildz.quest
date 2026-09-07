"use client";
import { Icons } from "@/components/icons";
import type { useWildsContinuousBuilder } from "./use-wilds-continuous-builder";
import { wildsConstructionCue, wildsConstructionLabel } from "./wilds-continuous-builder";
import { cumulativeWildsConstructionMaterials, wildsConstructionRecipe } from "./wilds-construction-recipes";
import type { WildsConstructionKind } from "./wilds-world-construction";

const groups: ReadonlyArray<{ label: string; kinds: readonly WildsConstructionKind[] }> = [
  { label: "Structure", kinds: ["foundation", "floor", "room", "wall", "roof", "door", "window", "column", "stair", "bridge", "platform", "path"] },
  { label: "Living", kinds: ["storage", "workshop", "habitat", "bed", "hearth", "light", "garden", "water"] },
  { label: "Finishing", kinds: ["trim", "railing", "partition"] }
];
export function WildsContinuousBuilderPanel({ builder, materials }: {
  builder: ReturnType<typeof useWildsContinuousBuilder>; materials: { hay: number; timber: number; stone: number };
}) {
  const cost = cumulativeWildsConstructionMaterials(wildsConstructionRecipe(builder.kind), "finished");
  const next = builder.progress?.stages.find(stage => !stage.complete);
  return <aside className="wilds-continuous-builder" aria-label="Build with pieces">
    <header><span><small>BUILD YOUR PLACE</small><select aria-label="Choose building piece" value={builder.selected ? "" : builder.kind} onChange={event => builder.selectKind(event.target.value as WildsConstructionKind)}><option value="" disabled>{builder.selected ? `${wildsConstructionLabel(builder.selected.kind)} · selected` : "Choose a piece"}</option>{groups.map(group => <optgroup key={group.label} label={group.label}>{group.kinds.map(kind => <option key={kind} value={kind}>{wildsConstructionLabel(kind)}</option>)}</optgroup>)}</select></span><button aria-label="Close piece builder" onClick={builder.close} type="button"><Icons.close size={18} /></button></header>
    <div className="wilds-builder-resources" aria-label="Carried building materials">
      <span><Icons.products size={15} /><b>{materials.hay}</b><small>Hay</small></span>
      <span><Icons.timber size={15} /><b>{materials.timber}</b><small>Timber</small></span>
      <span><Icons.quarry size={15} /><b>{materials.stone}</b><small>Stone</small></span>
    </div>
    {builder.selected && builder.progress ? <section className="wilds-builder-inspector" aria-label="Selected piece progress">
      <div className="wilds-builder-stages">{["planned", "framed", "functional", "finished"].map(stage => <span key={stage} aria-current={builder.progress?.stage === stage ? "step" : undefined}>{stage}</span>)}</div>
      <progress max={100} value={builder.progress.percentage} aria-label="Construction progress" /><strong>{builder.progress.percentage}% complete</strong>
      {next ? <><p>Next: {next.stage}. Add materials and do {next.work.remaining} more work action{next.work.remaining === 1 ? "" : "s"}.</p>
        <div className="wilds-builder-needed">{(["hay", "timber", "stone"] as const).map(kind => <span key={kind}>{kind}<b>{next.materials[kind].contributed}/{next.materials[kind].required}</b></span>)}</div>
        <div className="wilds-builder-actions"><button type="button" disabled={builder.busy || !builder.canDeposit} onClick={builder.addCarried}>Add what I carry</button><button type="button" disabled={builder.busy || !builder.canWork} onClick={builder.work}>Build {next.stage}</button></div>
        {!builder.canWork && <p>{next.materialsComplete ? "Move within 6 metres to work on this piece." : "Gather the missing materials to continue. No companion required."}</p>}
      </> : <p>Finished. Choose another piece below to keep building.</p>}
    </section> : <section className="wilds-builder-placement" aria-label="Piece placement">
      <strong>{wildsConstructionLabel(builder.kind)}</strong>
      <p>{builder.preview ? builder.preview.valid ? builder.canPlace ? "This piece fits. Confirm to mark its plan." : "Move closer to place this piece (within 6 metres)." : builder.preview.cues.map(wildsConstructionCue).join(" ") : "Tap the ground to position your plan. Tap an existing piece to continue its build. Planning needs no materials."}</p>
      <p className="wilds-builder-cost">Full build: {cost.hay} hay · {cost.timber} timber · {cost.stone} stone</p>
      <div className="wilds-builder-transforms"><button type="button" onClick={builder.rotate}>Rotate {builder.rotation * 90}°</button><button aria-label="Lower piece" type="button" onClick={builder.lower}>−</button><span>{builder.height * .5} m</span><button aria-label="Raise piece" type="button" onClick={builder.raise}>+</button><button aria-label="Clear placement preview" type="button" onClick={builder.undoPreview}>Reset</button></div>
      <button className="wilds-builder-confirm" type="button" disabled={builder.busy || !builder.canPlace} onClick={builder.place}>Place {wildsConstructionLabel(builder.kind).toLowerCase()} plan</button>
    </section>}
    {builder.nearbyPieces.length > 0 && <details className="wilds-builder-palette"><summary>Continue nearby builds ({builder.nearbyPieces.length})</summary><section><div>{builder.nearbyPieces.map((piece, index) => <button type="button" key={piece.componentId} onClick={() => builder.selectComponent(piece.componentId)}>{wildsConstructionLabel(piece.kind)} {index + 1}</button>)}</div></section></details>}
    <details open={!builder.selected} className="wilds-builder-palette"><summary>Choose building pieces</summary>
      {groups.map(group => <section key={group.label} aria-label={`${group.label} pieces`}><h3>{group.label}</h3><div>{group.kinds.map(kind => <button key={kind} type="button" aria-pressed={!builder.selected && builder.kind === kind} onClick={() => builder.selectKind(kind)}>{wildsConstructionLabel(kind)}</button>)}</div></section>)}
    </details>
  </aside>;
}
