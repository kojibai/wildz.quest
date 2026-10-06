"use client";
import { useMemo, useState } from "react";
import { Canvas } from "@react-three/fiber";
import { OrbitControls } from "@react-three/drei";
import { initialPlayState, applyWildsInput, type PlayState } from "./game-state";
import { createWildsConstructionProject, constructionProofDigest } from "./wilds-construction-project";
import { createWildsConstructionComponent, createWildsMaterialContribution, createWildsWorkContribution, projectWildsConstructionProgress } from "./wilds-construction-component";
import { createWildsBlueprintPreview, previewWildsBlueprintPlacement } from "./wilds-world-construction";
import { initialWildsWorldProjection } from "./wilds-world-state";
import { resolveWildsConstructionFunction, canSleepInWildsBed, projectWildsBedSleepPose } from "./wilds-construction-function";
import { WildsContinuousConstruction } from "./WildsContinuousConstruction";
import { WildsExplorer } from "./WildsExplorer";

function fixture() {
  const project = createWildsConstructionProject({ ownerReceizId: "fixture:other-owner", name: "Guest bed", region: { x: 0, z: 0 }, kaiUPulse: 1 });
  const base = createWildsBlueprintPreview(project.projectId, "wildz.excavation.region.v1:0:0");
  const foundation = previewWildsBlueprintPlacement({ blueprint: base, kind: "foundation", pointer: { x: 2, y: 0, z: 2 }, rotationQuarterTurns: 0, heightStep: 0, physical: { terrainY: 0, waterline: null, anchors: [], solids: [] } });
  const evidence = { sourceBlueprint: { ...base, pieces: [foundation] }, pointer: { x: 2, y: .6, z: 2 }, rotationQuarterTurns: 0, heightStep: 0, surfaceSnap: true, physical: { terrainY: 0, waterline: null, anchors: foundation.anchors, solids: foundation.collisionSolids } };
  const component = createWildsConstructionComponent({ project, evidence, placement: previewWildsBlueprintPlacement({ blueprint: evidence.sourceBlueprint, kind: "bed", ...evidence }), ownerReceizId: project.ownerReceizId, kaiUPulse: 2 });
  let index = 0;
  const lots = component.recipe.stages.flatMap(stage => (["hay", "timber", "stone"] as const).flatMap(kind => Array.from({ length: stage.materials[kind] }, () => {
    const basis = { schema: "wildz.material-lot.v1" as const, lotId: `wildz:material:${kind}:${(++index).toString(16).padStart(64, "0")}`, kind, quantity: 1 as const, quality: 1 as const, ownerReceizId: project.ownerReceizId, source: { sourceId: "source:fixture", sourceHead: `sha256:${"a".repeat(64)}`, admittedSourceHead: `sha256:${"b".repeat(64)}`, kaiUPulse: 1 }, contributors: { explorerReceizId: project.ownerReceizId }, authority: "source-proof-object" as const };
    return { ...basis, head: constructionProofDigest(basis) };
  })));
  const materials = lots.map(lot => createWildsMaterialContribution({ component, lot, custodianReceizId: project.ownerReceizId, contributorReceizId: project.ownerReceizId, commandId: `fixture:deposit:${lot.lotId}`, kaiUPulse: 3 }));
  const work = [createWildsWorkContribution({ component, materials, worker: { kind: "player", receizId: project.ownerReceizId }, amount: 100, commandId: "fixture:work", kaiUPulse: 4 })];
  const progress = projectWildsConstructionProgress(component, materials, work);
  const world = { ...initialWildsWorldProjection(), constructionComponents: { [component.componentId]: component }, materialLots: Object.fromEntries(lots.map(l => [l.lotId, l])), constructionMaterialContributions: Object.fromEntries(materials.map(p => [p.contributionId, p])), constructionWorkContributions: Object.fromEntries(work.map(p => [p.contributionId, p])), consumedMaterialLots: Object.fromEntries(progress.embeddedLotIds.map(id => [id, component.componentId])) };
  const bed = resolveWildsConstructionFunction(world, component.componentId, "bed")!;
  const state = { ...structuredClone(initialPlayState), inventory: [], energy: 35, player: { x: bed.position.x, z: bed.position.z }, siteSpace: { ...initialPlayState.siteSpace, position: { ...bed.position, y: bed.position.y - .35 } } };
  return { world, bed, state };
}
export function BedRestBrowserFixture() {
  const data = useMemo(fixture, []);
  const [state, setState] = useState<PlayState>(data.state);
  const sleeping = state.playerBreaths?.mode === "bed";
  const available = canSleepInWildsBed(data.bed, state.player, state.siteSpace);
  const act = (input: Parameters<typeof applyWildsInput>[1]) => setState(current => applyWildsInput(current, { ...input, kaiUPulse: (current.playerBreaths?.lastKaiUPulse ?? 100_000_000) + 10_000_000 }));
  return <main style={{ height: "100dvh", background: "#142921", color: "#eaf1dd", position: "relative" }}>
    <div style={{ position: "absolute", top: 20, left: 20, zIndex: 10, display: "flex", gap: 12, alignItems: "center" }}>
      {available && <button onClick={() => act(sleeping ? { type: "wake" } : { type: "rest", bed: data.bed })}>{sleeping ? "Wake up" : "Sleep in bed"}</button>}
      <button onClick={() => act({ type: "move-vector", x: 1, z: 0, mode: "walk" })}>Walk away</button>
      <output>{sleeping ? "Sleeping · breath recovery" : "Awake"} · {state.energy.toFixed(1)}%</output>
    </div>
    <Canvas shadows camera={{ position: [3.5, 3, 3.5], fov: 42 }}>
      <ambientLight intensity={1.7} /><directionalLight castShadow position={[3, 6, 2]} intensity={2.5} />
      <OrbitControls makeDefault target={[0, .55, 0]} />
      <mesh receiveShadow rotation={[-Math.PI / 2, 0, 0]} position={[0, -.02, 0]}><planeGeometry args={[12, 12]} /><meshStandardMaterial color="#486149" roughness={1} /></mesh>
      <WildsContinuousConstruction world={data.world} player={state.player} terrainElevation={state.siteSpace.position.y} spaceId={state.siteSpace.spaceId} />
      <WildsExplorer style="female" identityKey="fixture:sleeping-explorer" worldPosition={state.player} sleepPose={sleeping ? projectWildsBedSleepPose(data.bed, state.player, state.siteSpace.position.y) : undefined} />
    </Canvas>
  </main>;
}
