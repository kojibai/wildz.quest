"use client";
import { useMemo, useRef, useState } from "react";
import type { useWildsWorld } from "./use-wilds-world";
import type { WildsConstructionKind } from "./wilds-world-construction";
import type { WildsInteractionSurfacePoint } from "./wilds-surface-interaction";
import type { WildsMaterialLotV1 } from "./wilds-steward-construction";
import { projectWildsConstructionProgressFromWorld } from "./wilds-world-state";
import { previewWildsContinuousBuild, selectWildsConstructionDeposit, wildsConstructionLabel, wildsConstructionCue } from "./wilds-continuous-builder";
import { missingBuildMaterials, gatherBuildGuidance } from "./wilds-build-guidance";
import { previewWildsConstructionAdjustment, type WildsConstructionPlacementRequest } from "./wilds-construction-placement";
import { sampleWildsTerrain } from "./wilds-terrain-authority";

export function useWildsContinuousBuilder({ world, owner, player, lots, feedback, spaceId = "wildz.space.outer.v1" }: {
  world: ReturnType<typeof useWildsWorld>; owner: string; player: { x: number; z: number };
  spaceId?:string;
  lots: readonly WildsMaterialLotV1[]; feedback: (message: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [kind, setKind] = useState<WildsConstructionKind>("foundation");
  const [rotation, setRotation] = useState(0);
  const [height, setHeight] = useState(0);
  const [pointer, setPointer] = useState<WildsInteractionSurfacePoint | null>(null);
  const [inspecting, setInspecting] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [adjustmentHead, setAdjustmentHead] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [dragging,setDragging]=useState(false);
  const dragSource=useRef<{id:string;head:string;rotation:number;height:number}|null>(null);
  const lock = useRef(false);
  const snapshot = world.snapshot;
  const selected = selectedId ? snapshot?.constructionComponents[selectedId] ?? null : null;
  const progress = useMemo(() => selected && snapshot ? projectWildsConstructionProgressFromWorld(snapshot, selected.componentId) : null, [selected, snapshot]);
  const adjusting = adjustmentHead !== null;
  const adjustmentRequest: WildsConstructionPlacementRequest | null = pointer ? {...(spaceId!=="wildz.space.outer.v1"?{spaceId}:{}),pointer: {x:pointer.x, y:pointer.surfaceWorldY ?? sampleWildsTerrain(pointer.x,pointer.z).elevation, z:pointer.z}, rotationQuarterTurns:rotation, heightStep:height, surfaceSnap:true} : null;
  const adjustment = useMemo(() => {
    if (!adjusting || !selected || !snapshot || !pointer) return null;
    try { return previewWildsConstructionAdjustment(snapshot, selected.componentId, {...(spaceId!=="wildz.space.outer.v1"?{spaceId}:{}),pointer:{x:pointer.x,y:pointer.surfaceWorldY ?? sampleWildsTerrain(pointer.x,pointer.z).elevation,z:pointer.z},rotationQuarterTurns:rotation,heightStep:height,surfaceSnap:true}); }
    catch { return null; }
  }, [adjusting,selected,snapshot,pointer,rotation,height,spaceId]);
  const preview = useMemo(() => {
    if (!open || adjusting || !snapshot || !pointer) return null;
    try {
      return previewWildsContinuousBuild(snapshot, owner, kind, { ...(spaceId!=="wildz.space.outer.v1"?{spaceId}:{}), pointer: { x: pointer.x, y: pointer.surfaceWorldY ?? sampleWildsTerrain(pointer.x, pointer.z).elevation, z: pointer.z }, rotationQuarterTurns: rotation, heightStep: height, surfaceSnap: true });
    } catch { return null; }
  }, [open, adjusting, snapshot, pointer, kind, owner, rotation, height,spaceId]);
  const inReach = (point: { x: number; z: number }) => Math.hypot(player.x - point.x, player.z - point.z) <= 6;
  const deposit = progress ? selectWildsConstructionDeposit(lots, progress) : [];
  const nextStage = progress?.stages.find(stage => !stage.complete);
  const materialKinds = ["hay", "timber", "stone"] as const;
  const remaining = Object.fromEntries(materialKinds.map(kind => [kind, nextStage?.materials[kind].remaining ?? 0]));
  const carried = Object.fromEntries(materialKinds.map(kind => [kind, lots.filter(lot => lot.kind === kind).length]));
  const missing = missingBuildMaterials(remaining, carried);
  const workBlocker = !snapshot ? "Your world is loading. Wait for your saved builds to appear." : !selected ? "Select a nearby build to continue it." : !inReach(selected.transform.position) ? "Move within 6 metres of this piece, then try again." : !nextStage ? "This piece is finished. Choose another piece above to keep building." : !nextStage.materialsComplete ? missing ? gatherBuildGuidance(missing) : "You carry the materials for this stage. Tap Add what I carry first, then build." : null;
  const depositBlocker = !selected ? "Select a nearby build to add materials." : !inReach(selected.transform.position) ? "Move within 6 metres of this piece to add materials." : !deposit.length ? nextStage?.materialsComplete ? "This stage is funded. Tap Build to do the work." : workBlocker : null;
  const placeBlocker = !snapshot ? "Your world is loading. Wait for it to finish before placing a plan." : !preview ? pointer ? "This preview could not be resolved. Tap a clear ground spot to try again." : "Tap the ground to choose a position for this plan." : !preview.placement.valid ? preview.placement.cues.map(wildsConstructionCue).join(" ") : !inReach(preview.placement.transform.position) ? "Move within 6 metres of the plan to place it." : null;
  const adjustBlocker = !selected || selected.ownerReceizId !== owner ? "Select one of your pieces." : selected.head !== adjustmentHead ? "This piece changed. Cancel and select it again." : !inReach(selected.transform.position) ? "Move within 6 metres of this piece." : !adjustment ? "Drag the piece or its handles to adjust it." : adjustment.blocker ? adjustment.blocker : !adjustment.placement.valid ? adjustment.placement.cues.map(wildsConstructionCue).join(" ") : !inReach(adjustment.placement.transform.position) ? "Keep the new position within 6 metres." : JSON.stringify(adjustment.placement.transform) === JSON.stringify(selected.transform) ? "Move or rotate the piece to make an adjustment." : null;
  const cancelAdjustment = () => { if (lock.current) return; dragSource.current=null; setDragging(false); setAdjustmentHead(null); setPointer(null); setError(null); };
  const run = async (action: () => Promise<void>) => {
    if (lock.current) return;
    lock.current = true; setBusy(true); setError(null);
    try { await action(); } catch (error) {
      const message = error instanceof Error ? error.message : "";
      const explanation = /unreachable/.test(message) ? "Move closer to this piece (within 6 metres)."
        : /lot|material/.test(message) ? "Those materials have changed. Check your satchel and try again."
        : /placement|component_invalid|conflict/.test(message) ? "This piece could not be placed or adjusted here. Check its support and spacing, then try again."
        : "That build action could not complete. Your saved work is still here; try again.";
      setError(explanation); feedback(explanation);
    } finally { lock.current = false; setBusy(false); }
  };
  const placePreview = (preview: ReturnType<typeof previewWildsContinuousBuild> | null) => void run(async () => {
      if (!preview?.placement.valid || !snapshot || !inReach(preview.placement.transform.position)) return;
      let current = snapshot;
      let project = preview.project;
      if (!project) {
        current = await world.createConstructionProject("My place", preview.region);
        project = previewWildsContinuousBuild(current, owner, kind, preview.request).project;
      }
      if (!project) throw new Error("construction_project_missing");
      const fresh = previewWildsContinuousBuild(current, owner, kind, preview.request);
      const before = new Set(Object.keys(current.constructionComponents));
      const result = await world.placeConstructionComponent(project.projectId, fresh.placement, preview.request, player);
      const component = Object.values(result.constructionComponents).find(c => !before.has(c.componentId) && c.ownerReceizId === owner);
      if (component) { setSelectedId(component.componentId); setInspecting(false); }
      setPointer(null);
      feedback(`${wildsConstructionLabel(kind)} planned and locked. Add materials, then build each stage. You can do the work yourself.`);
    });
  return {
    dragging,
    inspecting,
    selectionEnabled: open && inspecting && !adjusting && !busy,
    editPieces: () => { if (lock.current) return; cancelAdjustment(); setInspecting(true); setSelectedId(null); setOpen(true); feedback("Tap the piece you want to edit. It stays locked until you unlock it."); },
    dragPiece:(id:string,point:WildsInteractionSurfacePoint,phase:"move"|"drop"|"cancel",transform?:{rotation:number;height:number})=>{
      if(phase==="cancel"){dragSource.current=null;setDragging(false);cancelAdjustment();return;}
      const component=snapshot?.constructionComponents[id];
      if(!adjusting || selectedId !== id || lock.current||!snapshot||!component||component.ownerReceizId!==owner)return;
      const source=dragSource.current??{id,head:component.head,rotation:component.transform.rotationQuarterTurns,height:component.evidence.heightStep};
      if(transform){source.rotation=transform.rotation;source.height=transform.height;}
      dragSource.current=source;
      setSelectedId(id);setOpen(true);setAdjustmentHead(source.head);setKind(component.kind);setRotation(source.rotation);setHeight(source.height);setPointer(point);setError(null);
      if(phase==="move"){setDragging(true);return;}
      setDragging(false);dragSource.current=null;
      void run(async()=>{
        if(source.head!==component.head)throw new Error("This piece changed. Select it again.");
        const request:WildsConstructionPlacementRequest={...(spaceId!=="wildz.space.outer.v1"?{spaceId}:{}),pointer:{x:point.x,y:point.surfaceWorldY??component.evidence.pointer.y,z:point.z},rotationQuarterTurns:source.rotation,heightStep:source.height,surfaceSnap:true};
        const next=previewWildsConstructionAdjustment(snapshot,id,request);
        if(!inReach(component.transform.position)||!inReach(next.placement.transform.position)){setAdjustmentHead(null);setPointer(null);setError("Keep the piece within 6 metres.");feedback("Keep the piece within 6 metres.");return;}
        if(next.blocker||!next.placement.valid){const reason=next.blocker??next.placement.cues.map(wildsConstructionCue).join(" ");setAdjustmentHead(null);setPointer(null);setError(reason);feedback(reason);return;}
        if(JSON.stringify(next.placement.transform)!==JSON.stringify(component.transform))await world.adjustConstructionComponent(id,source.head,next.placement,request,player);
        setAdjustmentHead(null);setPointer(null);feedback("Piece moved and locked. Materials and progress preserved.");
      });
    },
    nearbyPieces: Object.values(snapshot?.constructionComponents ?? {}).filter(component => component.ownerReceizId === owner && (component.evidence.spaceId??"wildz.space.outer.v1")===spaceId && Math.hypot(component.transform.position.x - player.x, component.transform.position.z - player.z) <= 24),
    open, kind, rotation, height, error, adjusting, adjustBlocker, placeBlocker, depositBlocker, workBlocker, preview: adjusting ? adjustment ? {...adjustment.placement, valid:adjustment.placement.valid && !adjustment.blocker} : null : preview?.placement ?? null, selected, progress, busy,
    canPlace: Boolean(preview?.placement.valid && inReach(preview.placement.transform.position)),
    canDeposit: Boolean(selected && inReach(selected.transform.position) && deposit.length),
    canWork: Boolean(selected && inReach(selected.transform.position) && nextStage?.materialsComplete),
    begin: () => { setInspecting(false); setAdjustmentHead(null); setOpen(true); setPointer(null); setSelectedId(null); setError(null); },
    close: () => { if (lock.current) return; setAdjustmentHead(null); setOpen(false); setPointer(null); },
    selectKind: (next: WildsConstructionKind) => { if (lock.current) return; dragSource.current=null; setDragging(false); setAdjustmentHead(null); setInspecting(false); setKind(next); setPointer(null); setSelectedId(null); setError(null); },
    selectComponent: (id: string) => { if (lock.current || adjusting) return; setInspecting(true); setAdjustmentHead(null); setSelectedId(id); setPointer(null); setOpen(true); setError(null); },
    point: (next: WildsInteractionSurfacePoint) => {
      // Construction admits locally; unrelated global sync must not swallow a placement tap.
      if (lock.current || !snapshot) return;
      if (inspecting || adjusting) return;
      setPointer(next); setSelectedId(null); setError(null);
      try {
        const tapped = previewWildsContinuousBuild(snapshot, owner, kind, { ...(spaceId!=="wildz.space.outer.v1"?{spaceId}:{}), pointer: { x: next.x, y: next.surfaceWorldY ?? sampleWildsTerrain(next.x, next.z).elevation, z: next.z }, rotationQuarterTurns: rotation, heightStep: height, surfaceSnap: true });
        if (!tapped.placement.valid) { const reason = tapped.placement.cues.map(wildsConstructionCue).join(" "); setError(reason); feedback(reason); return; }
        if (!inReach(tapped.placement.transform.position)) { const reason = "Move within 6 metres of this spot, then tap to place your piece."; setError(reason); feedback(reason); return; }
        placePreview(tapped);
      } catch { setError("This spot could not be resolved. Tap a clear ground spot to try again."); }
    },
    beginAdjustment: () => {
      if (!selected || selected.ownerReceizId !== owner || lock.current) return;
      setInspecting(true); setAdjustmentHead(selected.head); setKind(selected.kind); setRotation(selected.transform.rotationQuarterTurns);
      setHeight(selected.evidence.heightStep); setPointer(null); setError(null);
      feedback("Unlocked. Drag this piece or its handles. Release to save and lock.");
    },
    cancelAdjustment,
    nudge: (x: number, z: number) => { if (lock.current) return; setPointer(current => current ? {...current,x:Math.round((current.x+x*.5)*2)/2,z:Math.round((current.z+z*.5)*2)/2} : current); },
    confirmAdjustment: () => void run(async () => {
      if (adjustBlocker || !selected || !adjustment || !adjustmentRequest || !adjustmentHead) return;
      await world.adjustConstructionComponent(selected.componentId, adjustmentHead, adjustment.placement, adjustmentRequest, player);
      setAdjustmentHead(null); setPointer(null); feedback(`${wildsConstructionLabel(selected.kind)} adjusted. Materials and progress preserved.`);
    }),
    rotate: () => setRotation(value => (value + 1) % 4),
    raise: () => setHeight(value => Math.min(32, value + 1)),
    lower: () => setHeight(value => Math.max(-32, value - 1)),
    undoPreview: () => { setPointer(null); setHeight(0); setRotation(0); },
    place: () => placePreview(preview),
    addCarried: () => void run(async () => {
      if (!selected || !deposit.length || !inReach(selected.transform.position)) return;
      await world.depositConstructionMaterial(selected.componentId, selected.head, deposit, player);
      feedback("Materials added. Build the next funded stage, or gather what remains.");
    }),
    work: () => void run(async () => {
      if (!selected || !nextStage?.materialsComplete || !inReach(selected.transform.position)) return;
      const result = await world.workConstructionComponent(selected.componentId, selected.head, player);
      const next = projectWildsConstructionProgressFromWorld(result, selected.componentId);
      feedback(next.stage === "finished" ? `${wildsConstructionLabel(selected.kind)} finished. Choose another piece to keep building.` : `${wildsConstructionLabel(selected.kind)} · ${next.percentage}% complete.`);
    })
  };
}
