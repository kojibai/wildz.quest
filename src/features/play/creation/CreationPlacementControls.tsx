'use client';
import { Check } from 'lucide-react';
import type { RefObject } from 'react';
import { WildzDpad } from '../WildzDpad';
import type { WildsInput } from '../game-state';
import type { CreationPose } from './types';
import styles from './creation.module.css';
export function CreationPlacementControls({pose,headingRef,onPlace,onMove,canBuild,onMovementInput}:{pose:CreationPose;headingRef:RefObject<number>;onPlace:()=>void;onMove:(pose:CreationPose)=>void;canBuild:boolean;onMovementInput?:(input:WildsInput)=>void}) {
 return <div className={styles.placementControls} role="group" aria-label="Creation placement controls">
  <WildzDpad cameraHeadingRef={headingRef} movementMode="walk" label={onMovementInput?"Movement trackpad. Walk around your creation. Hold and drag, or use arrow keys.":"Move creation preview. Hold and drag, or use arrow keys."} onInput={input=>{if(onMovementInput){onMovementInput(input);return;}if(input.type==='move-vector')onMove({...pose,position:{...pose.position,x:pose.position.x+input.x*.25,z:pose.position.z+input.z*.25}});}}/>
  {canBuild?<button type="button" className={styles.placeButton} aria-label="Build creation here" title={canBuild?'Build here':'Preview only · world admission unavailable'} disabled={!canBuild} onClick={onPlace}><Check size={18}/></button>:null}
 </div>;
}
