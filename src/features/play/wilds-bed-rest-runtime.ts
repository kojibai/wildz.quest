import { applyWildsInput, type PlayState } from './game-state';

/** Reconcile a saved rest marker against the loaded physical bed sources. */
export function reconcileWildsBedRest(state:PlayState,input:{worldReady:boolean;creationReady:boolean;bedAvailable:boolean;restoredFloorY?:number|null;readKai:()=>number}):PlayState{
  if(!input.worldReady||state.playerBreaths?.mode!=='bed'||input.bedAvailable)return state;
  if(state.playerBedRest?.instanceId&&!input.creationReady)return state;
  if(state.playerBedRest?.instanceId&&Number.isFinite(input.restoredFloorY)&&Math.abs(state.siteSpace.position.y-input.restoredFloorY!)>1e-6)return {
    ...state,siteSpace:{...state.siteSpace,position:{...state.siteSpace.position,y:input.restoredFloorY!}}
  };
  // Read when the state updater executes, after any queued energy settlement.
  // A restored future coordinate remains untouched until the live clock catches up.
  const kaiUPulse=input.readKai();
  if(!Number.isSafeInteger(kaiUPulse)||kaiUPulse<state.playerBreaths.lastKaiUPulse)return state;
  return applyWildsInput(state,{type:'wake',kaiUPulse});
}
