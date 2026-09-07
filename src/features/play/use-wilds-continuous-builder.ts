"use client";
import { useMemo, useRef, useState } from "react";
import type { useWildsWorld } from "./use-wilds-world";
import type { WildsConstructionKind } from "./wilds-world-construction";
import type { WildsInteractionSurfacePoint } from "./wilds-surface-interaction";
import type { WildsMaterialLotV1 } from "./wilds-steward-construction";
import { projectWildsConstructionProgressFromWorld } from "./wilds-world-state";
import { previewWildsContinuousBuild, selectWildsConstructionDeposit, wildsConstructionLabel } from "./wilds-continuous-builder";
import { sampleWildsTerrain } from "./wilds-terrain-authority";

export function useWildsContinuousBuilder({ world, owner, player, lots, feedback }: {
  world: ReturnType<typeof useWildsWorld>; owner: string; player: { x: number; z: number };
  lots: readonly WildsMaterialLotV1[]; feedback: (message: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [kind, setKind] = useState<WildsConstructionKind>("foundation");
  const [rotation, setRotation] = useState(0);
  const [height, setHeight] = useState(0);
  const [pointer, setPointer] = useState<WildsInteractionSurfacePoint | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const lock = useRef(false);
  const snapshot = world.snapshot;
  const selected = selectedId ? snapshot?.constructionComponents[selectedId] ?? null : null;
  const progress = useMemo(() => selected && snapshot ? projectWildsConstructionProgressFromWorld(snapshot, selected.componentId) : null, [selected, snapshot]);
  const preview = useMemo(() => {
    if (!open || !snapshot || !pointer) return null;
    try {
      return previewWildsContinuousBuild(snapshot, owner, kind, { pointer: { x: pointer.x, y: pointer.surfaceWorldY ?? sampleWildsTerrain(pointer.x, pointer.z).elevation, z: pointer.z }, rotationQuarterTurns: rotation, heightStep: height, surfaceSnap: true });
    } catch { return null; }
  }, [open, snapshot, pointer, kind, owner, rotation, height]);
  const inReach = (point: { x: number; z: number }) => Math.hypot(player.x - point.x, player.z - point.z) <= 6;
  const deposit = progress ? selectWildsConstructionDeposit(lots, progress) : [];
  const nextStage = progress?.stages.find(stage => !stage.complete);
  const run = async (action: () => Promise<void>) => {
    if (lock.current) return;
    lock.current = true; setBusy(true);
    try { await action(); } catch (error) {
      const message = error instanceof Error ? error.message : "";
      feedback(/unreachable/.test(message) ? "Move closer to this piece (within 6 metres)."
        : /lot|material/.test(message) ? "Those materials have changed. Check your satchel and try again."
        : /placement|component_invalid|conflict/.test(message) ? "This place changed. Tap the ground again to refresh the preview."
        : "That build action could not complete. Your saved work is still here; try again.");
    } finally { lock.current = false; setBusy(false); }
  };
  return {
    nearbyPieces: Object.values(snapshot?.constructionComponents ?? {}).filter(component => component.ownerReceizId === owner && Math.hypot(component.transform.position.x - player.x, component.transform.position.z - player.z) <= 24),
    open, kind, rotation, height, preview: preview?.placement ?? null, selected, progress, busy,
    canPlace: Boolean(preview?.placement.valid && inReach(preview.placement.transform.position)),
    canDeposit: Boolean(selected && inReach(selected.transform.position) && deposit.length),
    canWork: Boolean(selected && inReach(selected.transform.position) && nextStage?.materialsComplete),
    begin: () => { setOpen(true); setPointer(null); setSelectedId(null); },
    close: () => { setOpen(false); setPointer(null); },
    selectKind: (next: WildsConstructionKind) => { setKind(next); setSelectedId(null); },
    selectComponent: (id: string) => { setSelectedId(id); setPointer(null); setOpen(true); },
    point: (next: WildsInteractionSurfacePoint) => { setPointer(next); setSelectedId(null); },
    rotate: () => setRotation(value => (value + 1) % 4),
    raise: () => setHeight(value => Math.min(32, value + 1)),
    lower: () => setHeight(value => Math.max(-32, value - 1)),
    undoPreview: () => { setPointer(null); setHeight(0); setRotation(0); },
    place: () => void run(async () => {
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
      if (component) setSelectedId(component.componentId);
      setPointer(null);
      feedback(`${wildsConstructionLabel(kind)} planned. Add materials, then build each stage. You can do the work yourself.`);
    }),
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
