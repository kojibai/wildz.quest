"use client";
import { useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import type { Group } from "three";
import type { PortableCardAsset } from "./portable-card";
import { projectCardKaiAppearance } from "./card-kai-appearance";
import { WildsCreatureActor } from "./WildsCreatureActor";
import { projectWildsTerrainActorPosition } from "./wilds-terrain-rendering";

export type WildsHomeResidentsInput = Readonly<{ shelterPosition: { x:number; z:number }; cards: readonly PortableCardAsset[] }>;

export function WildsHomeResidents({ cards, shelterPosition, player, terrainElevation, reducedMotion }: WildsHomeResidentsInput & { player: {x:number;z:number}; terrainElevation:number; reducedMotion:boolean }) {
  return <group name="shelter-owned-companions">{cards.map((card,index) => <Resident key={card.id} card={card} index={index} shelterPosition={shelterPosition} player={player} terrainElevation={terrainElevation} reducedMotion={reducedMotion} />)}</group>;
}

function Resident({ card,index,shelterPosition,player,terrainElevation,reducedMotion }: {card:PortableCardAsset;index:number;shelterPosition:{x:number;z:number};player:{x:number;z:number};terrainElevation:number;reducedMotion:boolean}) {
  const appearance = useMemo(() => projectCardKaiAppearance(card),[card]);
  const root = useRef<Group>(null);
  const position = useMemo(() => projectWildsTerrainActorPosition({x:shelterPosition.x + (index === 0 ? -2.4 : 2.4),z:shelterPosition.z + 1.6},{x:player.x,z:player.z},.2,{anchorElevation:terrainElevation}),[shelterPosition.x,shelterPosition.z,player.x,player.z,terrainElevation,index]);
  useFrame(({clock}) => {
    if (!root.current) return;
    // A quiet lookout turns in place; no terrain sampling or allocations in the frame loop.
    root.current.rotation.y = index === 0 ? .65 : -.65 + (reducedMotion ? 0 : Math.sin(clock.elapsedTime*.18)*.22);
  });
  return <group ref={root} name={`home-resident-${index+1}`} position={position} scale={index === 0 ? .58 : .65}>
    <WildsCreatureActor accent={appearance.palette.accent} anatomy={appearance.anatomy} cadenceMs={appearance.cadenceMs} familyId={card.manifest.familyId} formId={card.manifest.formId} glow={appearance.palette.glow} identityToken={appearance.fingerprint} morphology={appearance.morphology} pose={index === 0 ? "idle" : "curious"} primary={appearance.palette.primary} secondary={appearance.palette.secondary} />
  </group>;
}
