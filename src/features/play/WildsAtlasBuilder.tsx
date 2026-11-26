"use client";

import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { ArrowDown, ArrowLeft, ArrowRight, ArrowUp, Hammer, LocateFixed, RotateCw, SlidersHorizontal, Sparkles, Undo2 } from "lucide-react";
import { creationBuildInReach, CREATION_PHYSICAL_BUILD_REACH_RULE } from "./creation/build-reach";
import { projectCreationWorkers } from "./creation/capabilities";
import type { CreationCompileContext, CreationDraftGeometry } from "./creation/compiler";
import { createCreationProposalClient } from "./creation/proposal-worker-client";
import type { CreationPlannerPort } from "./creation/planner";
import type { CreationPoint, CreationPose } from "./creation/types";
import { useCreationConversation } from "./creation/use-creation-conversation";
import type { CreationSessionProps } from "./creation/CreationSession";
import styles from "./WildsAtlasBuilder.module.css";

export type WildsAtlasBuildSite = { x: number; z: number; yaw: number };
export type WildsAtlasBuildPreview = { geometry: CreationDraftGeometry; pose: CreationPose };

export type WildsAtlasBuilder = {
  active: boolean;
  position: { x: number; z: number } | null;
  preview: WildsAtlasBuildPreview | null;
  panel: ReactNode;
  onOpen: () => void;
  onClose: () => void;
  onChooseSite: (position: { x: number; z: number }) => void;
  onDropSite: (position: { x: number; z: number }) => void;
};

type AtlasBuilderPanelProps = Pick<CreationSessionProps, "ownerId" | "spaceId" | "cards" | "conditions" | "lots" | "context" | "cardAdmissions" | "commit" | "recover" | "validatePlacement"> & {
  actorPosition: CreationPoint;
  actorSpaceId: string;
  moving: boolean;
  canUndo: boolean;
  onMove: () => void;
  onAdjust: (site: WildsAtlasBuildSite) => void;
  onUndo: () => void;
  onPreview: (preview: WildsAtlasBuildPreview | null) => void;
  onCommitting: (busy: boolean) => void;
  onTrackSite: () => void;
};

export function WildsAtlasBuilderPanel({ actorPosition, actorSpaceId, moving, canUndo, onMove, onAdjust, onUndo, onPreview, onCommitting, onTrackSite,
  ownerId, spaceId, cards, conditions, context, cardAdmissions, lots, commit, recover, validatePlacement }: AtlasBuilderPanelProps) {
  const [adjusting, setAdjusting] = useState(false);
  const [crewChosen, setCrewChosen] = useState(false);
  const workers = useMemo(() => projectCreationWorkers(cards, conditions), [cards, conditions]);
  const client = useRef<ReturnType<typeof createCreationProposalClient> | null>(null);
  const planner = useMemo<CreationPlannerPort>(() => ({ propose(request, signal) {
    client.current ??= createCreationProposalClient();
    return client.current.propose(request, { cards, cardAdmissions, lots, allowLocalOnUnavailable: true }, signal);
  } }), [cards, cardAdmissions, lots]);
  useEffect(() => () => { client.current?.close(); client.current = null; }, []);

  const conversation = useCreationConversation({
    ownerId, spaceId, workers, context, planner, recover, validatePlacement, draftChannel: "atlas",
    commit: commit && ((plan, definition, workerIds, selected, compileContext) => commit(definition, plan, workerIds, selected, compileContext))
  });
  const { state, change, draftReady, draftGeometry } = conversation;
  const readyWorkers = workers.filter(worker => worker.ready);
  const materialCounts = useMemo(() => lots.reduce<Record<string, number>>((amounts, lot) => {
    amounts[lot.kind] = (amounts[lot.kind] ?? 0) + lot.quantity;
    return amounts;
  }, {}), [lots]);
  useEffect(() => {
    if (!draftReady || crewChosen || !workers.some(worker => worker.ready)) return;
    setCrewChosen(true);
    if (!state.workerIds.length) change({ type: "workers", ids: workers.filter(worker => worker.ready).map(worker => worker.assetId).slice(0, 32) });
  }, [change, crewChosen, draftReady, state.workerIds.length, workers]);

  const requestedPose = context.pose;
  useEffect(() => {
    if (state.placement.position.x === requestedPose.position.x && state.placement.position.z === requestedPose.position.z && state.placement.yaw === requestedPose.yaw) return;
    change({ type: "placement", pose: requestedPose });
  }, [change, requestedPose, state.placement]);

  const geometry = state.instance ? null : state.status === "blocked" ? draftGeometry ?? state.plan : state.plan ?? draftGeometry;
  const preview = useMemo<WildsAtlasBuildPreview | null>(() => geometry ? {
    geometry,
    pose: geometry.pose.position.x === requestedPose.position.x && geometry.pose.position.z === requestedPose.position.z && geometry.pose.yaw === requestedPose.yaw ? geometry.pose : requestedPose
  } : null, [geometry, requestedPose]);
  useEffect(() => { onPreview(preview); }, [onPreview, preview]);
  useEffect(() => () => onPreview(null), [onPreview]);

  const committing = state.status === "committing" || state.status === "recovering";
  const planning = state.status === "planning";
  useEffect(() => { onCommitting(committing); }, [committing, onCommitting]);
  useEffect(() => () => onCommitting(false), [onCommitting]);
  const inReach = Boolean(geometry && actorSpaceId === spaceId && creationBuildInReach(geometry, actorPosition, CREATION_PHYSICAL_BUILD_REACH_RULE.id));
  const atRequestedSite = state.plan?.pose.position.x === requestedPose.position.x && state.plan.pose.position.z === requestedPose.position.z && state.plan.pose.yaw === requestedPose.yaw;
  const canBuild = conversation.canBuild && inReach && atRequestedSite;
  const { x, z } = requestedPose.position;
  const yaw = requestedPose.yaw;
  const update = (dx: number, dz: number, angle = 0) => onAdjust({ x: x + dx, z: z + dz, yaw: (yaw + angle) % (Math.PI * 2) });

  return <section className={styles.panel}>
    <form onSubmit={event => { event.preventDefault(); if (state.draft.trim() && state.workerIds.length && !planning && !committing) void conversation.ask(); }}>
      <label className={styles.srOnly} htmlFor="wilds-atlas-build-prompt">{state.definition && !state.instance ? "Refine your design" : "Describe what to build"}</label>
      <textarea id="wilds-atlas-build-prompt" value={state.draft} maxLength={4000} rows={1}
        placeholder="A timber cabin with a bed and a covered porch…" disabled={committing || planning || Boolean(state.instance)}
        onChange={event => change({ type: "draft", text: event.target.value })} onKeyDown={event => event.stopPropagation()} />
      {state.instance ? <button type="button" onClick={() => change({ type: "selection", definition: null })}>Start another build</button>
        : <button className={styles.primary} type="submit" disabled={!state.draft.trim() || !state.workerIds.length || planning || committing}><Sparkles size={16} aria-hidden="true" />{planning ? "Working…" : "Preview"}</button>}
    </form>
    <div className={styles.tools} role="group" aria-label="Placement tools">
      <button type="button" aria-label="Move by tapping terrain" aria-pressed={moving} disabled={committing} onClick={onMove}><LocateFixed size={15} aria-hidden="true" /></button>
      <button type="button" disabled={committing} aria-label="Rotate ninety degrees" onClick={() => update(0, 0, Math.PI / 2)}><RotateCw size={15} aria-hidden="true" /></button>
      <button type="button" aria-label="Fine placement adjustments" aria-expanded={adjusting} disabled={committing} onClick={() => setAdjusting(value => !value)}><SlidersHorizontal size={15} aria-hidden="true" /></button>
      <button type="button" disabled={committing || !canUndo} aria-label="Undo placement" onClick={onUndo}><Undo2 size={15} aria-hidden="true" /></button>
    <button type="button" className={styles.commit} disabled={!canBuild} onClick={() => { if (canBuild) void conversation.build(); }}><Hammer size={16} aria-hidden="true" />{committing ? "Checking…" : "Commit build"}</button>
    </div>
    {moving ? <p role="status">Tap charted terrain to move the build.</p> : null}
    {adjusting ? <div className={styles.tools} role="group" aria-label="Fine placement adjustments">
      <button type="button" disabled={committing} aria-label="Move north one metre" onClick={() => update(0, -1)}><ArrowUp size={14} /></button>
      <button type="button" disabled={committing} aria-label="Move west one metre" onClick={() => update(-1, 0)}><ArrowLeft size={14} /></button>
      <button type="button" disabled={committing} aria-label="Move east one metre" onClick={() => update(1, 0)}><ArrowRight size={14} /></button>
      <button type="button" disabled={committing} aria-label="Move south one metre" onClick={() => update(0, 1)}><ArrowDown size={14} /></button>
      <button type="button" disabled={committing} aria-label="Rotate left fifteen degrees" onClick={() => update(0, 0, -Math.PI / 12)}>−15°</button>
      <button type="button" disabled={committing} aria-label="Rotate right fifteen degrees" onClick={() => update(0, 0, Math.PI / 12)}>+15°</button>
    </div> : null}
    {state.reason ? <p role="status">{state.reason}</p> : null}
    <details><summary>Build details</summary>
      <p className={styles.coordinates}>X {x.toFixed(1)} · Z {z.toFixed(1)} <span>{Math.round((yaw * 180 / Math.PI + 360) % 360)}°</span></p>
      {!readyWorkers.length ? <p>Bring a ready creature to design and build with you.</p> : <details>
        <summary>Creature crew · {state.workerIds.length} selected</summary>
        <div className={styles.crew}>{readyWorkers.map(worker => <label key={worker.assetId}>
          <input type="checkbox" checked={state.workerIds.includes(worker.assetId)} disabled={planning || committing || state.workerIds.length >= 32 && !state.workerIds.includes(worker.assetId)}
            onChange={event => change({ type: "workers", ids: event.target.checked ? [...state.workerIds, worker.assetId] : state.workerIds.filter(id => id !== worker.assetId) })} />
          {cards.find(card => card.id === worker.assetId)?.manifest.name ?? "Companion"}
        </label>)}</div>
      </details>}
      {state.quote ? <div className={styles.quote} aria-label="Build cost">
        <strong>Material cost</strong>
        {Object.entries(state.quote.requiredResources).map(([kind, amount]) => <span key={kind}>{amount} {kind}<small>{materialCounts[kind] ?? 0} carried</small></span>)}
      </div> : null}
      {geometry?.chunks.length ? <AtlasFootprint geometry={geometry} /> : null}
      {geometry && !inReach ? <button type="button" onClick={onTrackSite}>Track build site</button> : null}
    </details>
    {geometry && !inReach ? <p>{actorSpaceId !== spaceId ? "Return to the surface before building." : "Build from within 12 metres of the site."}</p> : null}
  </section>;
}

function AtlasFootprint({ geometry }: { geometry: CreationDraftGeometry }) {
  const bounds = geometry.chunks.reduce((area, { bounds: { min, max } }) => ({
    minX: Math.min(area.minX, min.x), maxX: Math.max(area.maxX, max.x),
    minZ: Math.min(area.minZ, min.z), maxZ: Math.max(area.maxZ, max.z)
  }), { minX: Infinity, maxX: -Infinity, minZ: Infinity, maxZ: -Infinity });
  return <p className={styles.coordinates}>Footprint <span>{(bounds.maxX - bounds.minX).toFixed(1)} m × {(bounds.maxZ - bounds.minZ).toFixed(1)} m</span></p>;
}
