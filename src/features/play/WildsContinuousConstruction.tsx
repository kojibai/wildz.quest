"use client";
import { useMemo } from "react";
import type { ThreeEvent } from "@react-three/fiber";
import type { WildsWorldProjection } from "./wilds-world-state";
import type { WildsBlueprintPlacement } from "./wilds-world-construction";
import { projectWildsConstructionStageGeometry } from "./wilds-construction-geometry";

export function WildsContinuousConstruction({ world, player, terrainElevation, preview, selectable, onSelect }: {
  world?: WildsWorldProjection | null; player: { x: number; z: number }; terrainElevation: number;
  preview?: WildsBlueprintPlacement | null; selectable?: boolean; onSelect?: (id: string) => void;
}) {
  // Proof and stage projections run only when the snapshot changes, never in useFrame.
  const pieces = useMemo(() => !world ? [] : Object.values(world.constructionComponents ?? {}).map(component => ({ component,
    geometry: projectWildsConstructionStageGeometry(component, Object.values(world.constructionMaterialContributions), Object.values(world.constructionWorkContributions))
  })), [world]);
  return <group name="continuous-construction" position={[-player.x, -terrainElevation, -player.z]}>
    {pieces.filter(({ component }) => Math.hypot(component.transform.position.x - player.x, component.transform.position.z - player.z) <= 64).map(({ component, geometry }) => {
      const box = component.placement.geometry;
      const planned = geometry.stage === "planned";
      const color = geometry.stage === "framed" ? "#94734e" : geometry.stage === "finished" ? "#c7ae83" : "#af9166";
      const select = (event: ThreeEvent<MouseEvent>) => { if (selectable) { event.stopPropagation(); onSelect?.(component.componentId); } };
      return <group key={component.componentId} name={`construction-stage-${geometry.stage}`} onClick={select}>
        {planned ? <group name="construction-plan-stakes">
          {[-1, 1].flatMap(x => [-1, 1].map(z => <mesh key={`${x}:${z}`} position={[box.center.x + x * box.halfExtents.x, box.center.y - box.halfExtents.y + .3, box.center.z + z * box.halfExtents.z]}><boxGeometry args={[.09, .6, .09]} /><meshStandardMaterial color="#9dddbf" /></mesh>))}
          <mesh position={[box.center.x, box.center.y - box.halfExtents.y + .025, box.center.z]}><boxGeometry args={[box.halfExtents.x * 2, .05, box.halfExtents.z * 2]} /><meshStandardMaterial color="#72d9b7" transparent opacity={.32} depthWrite={false} /></mesh>
        </group> : geometry.solids.map(solid => <mesh castShadow receiveShadow key={solid.id} position={[solid.center.x, solid.center.y, solid.center.z]}>
          <boxGeometry args={[solid.halfExtents.x * 2, solid.halfExtents.y * 2, solid.halfExtents.z * 2]} />
          <meshStandardMaterial color={component.kind === "foundation" || component.kind === "path" || component.kind === "hearth" ? "#8f9b91" : color} roughness={.86} />
        </mesh>)}
        {!planned && component.kind === "water" && <mesh position={[box.center.x, box.center.y, box.center.z]}><boxGeometry args={[box.halfExtents.x * 2, .08, box.halfExtents.z * 2]} /><meshStandardMaterial color="#70cddd" transparent opacity={.7} /></mesh>}
        {(geometry.stage === "functional" || geometry.stage === "finished") && (component.kind === "light" || component.kind === "hearth") && <mesh position={[box.center.x, box.center.y + box.halfExtents.y, box.center.z]}><sphereGeometry args={[.16, 8, 6]} /><meshStandardMaterial color="#ffe7a4" emissive="#ffbf60" emissiveIntensity={2} /></mesh>}
      </group>;
    })}
    {preview && <group name="construction-placement-ghost">
      {preview.collisionSolids.map(solid => <mesh key={solid.id} position={[solid.center.x, solid.center.y, solid.center.z]} raycast={() => {}}><boxGeometry args={[solid.halfExtents.x * 2, solid.halfExtents.y * 2, solid.halfExtents.z * 2]} /><meshBasicMaterial color={preview.valid ? "#78efbc" : "#ff8a82"} transparent opacity={.38} depthWrite={false} /></mesh>)}
      {preview.collisionSolids.length === 0 && <mesh position={[preview.geometry.center.x, preview.geometry.center.y, preview.geometry.center.z]} raycast={() => {}}><boxGeometry args={[preview.geometry.halfExtents.x * 2, .1, preview.geometry.halfExtents.z * 2]} /><meshBasicMaterial color={preview.valid ? "#78efbc" : "#ff8a82"} transparent opacity={.38} depthWrite={false} /></mesh>}
    </group>}
  </group>;
}
