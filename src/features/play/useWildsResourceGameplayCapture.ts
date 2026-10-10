'use client';
import {useCallback,useEffect,useRef} from 'react';
import type {PlayState,WildsInput} from './game-state';
import {createWildsResourceCaptureMarker,sameWildsResourceCaptureBinding,wildsResourceCaptureMarkerId,wildsResourceCaptureCommitted,type WildsResourceCaptureMarker,type WildsResourceCaptureBinding} from './wilds-resource-gameplay-capture';
import {isWildsResourceGameplayWorldCommandV128,type WildsResourceGameplayCommandV128} from '@/lib/receiz/wilds-resource-gameplay-v128';
import type {WildsWorldOutboxEntry} from './wilds-world-outbox';
import type {WildsCreatureMandateV1} from './wilds-creature-mandate';

/** The existing reducer stays immediate. Only committed command custody is
 * queued here; SDK opening, sealing and global admission happen on wallet Send. */
export function useWildsResourceGameplayCapture(input:{enabled:boolean;ownerHandle:string|null;gameplayOwnerId:string;state:PlayState}) {
  const live=useRef(input);live.current=input;
  const pending=useRef(new Map<string,WildsResourceCaptureMarker>());
  const persistence=useRef(Promise.resolve());
  const error=useRef<string|null>(null);
  const {playerNourishment,playerLivestock}=input.state;
  const record=useCallback((command:WildsResourceGameplayCommandV128,captured?:WildsResourceCaptureBinding)=>{
    const current=live.current;if(!current.enabled||!current.ownerHandle)return;
    const binding=captured??{ownerHandle:current.ownerHandle,gameplayOwnerId:current.gameplayOwnerId};
    if(!sameWildsResourceCaptureBinding(binding,{ownerHandle:current.ownerHandle,gameplayOwnerId:current.gameplayOwnerId}))return;
    persistence.current=persistence.current.then(async()=>{
      const [{defaultContinuityDatabase},{queueWildsResourceGameplayV128}]=await Promise.all([
        import('@/lib/receiz/wildz-active-identity'),import('@/lib/receiz/wilds-resource-gameplay-store-v128')]);
      await queueWildsResourceGameplayV128({database:defaultContinuityDatabase,ownerReceizId:binding.ownerHandle,gameplayOwnerId:binding.gameplayOwnerId,command});
    }).catch(cause=>{if(live.current.ownerHandle===binding.ownerHandle&&live.current.gameplayOwnerId===binding.gameplayOwnerId)error.current=cause instanceof Error?cause.message:'wilds_resource_history_write_failed';});
  },[]);
  useEffect(()=>{
    for(const [id,candidate] of pending.current){
      if(!input.enabled||!input.ownerHandle||!sameWildsResourceCaptureBinding(candidate.binding,{ownerHandle:input.ownerHandle,gameplayOwnerId:input.gameplayOwnerId})){pending.current.delete(id);continue;}
      // React may replay an updater. Only a committed consequence can enter custody.
      const committed=wildsResourceCaptureCommitted(candidate,{playerNourishment,playerLivestock},candidate.binding);
      if(committed){pending.current.delete(id);record(candidate.command,candidate.binding);}
      else if(candidate.command.kaiUPulse<=Math.max(playerNourishment?.lastKaiUPulse??0,playerLivestock?.lastKaiUPulse??0))pending.current.delete(id);
    }
  },[playerNourishment,playerLivestock,input.enabled,input.ownerHandle,input.gameplayOwnerId,record]);
  useEffect(()=>{error.current=null;},[input.ownerHandle,input.gameplayOwnerId]);
  return {
    captureInput(before:PlayState,after:PlayState,action:WildsInput){
      const current=live.current;if(!current.enabled||!current.ownerHandle)return;
      const marker=createWildsResourceCaptureMarker(before,after,action,{ownerHandle:current.ownerHandle,gameplayOwnerId:current.gameplayOwnerId});if(!marker)return;
      if(pending.current.size>=128){error.current='wilds_resource_history_capture_full';return;}
      pending.current.set(wildsResourceCaptureMarkerId(marker),marker);
    },
    captureWorld:useCallback((entry:WildsWorldOutboxEntry,groveMandate?:WildsCreatureMandateV1)=>{
      if(!isWildsResourceGameplayWorldCommandV128(entry.command))return;
      if(entry.actorId!==live.current.gameplayOwnerId)return;
      const pulse=entry.command.kai?.uPulse;if(!Number.isSafeInteger(pulse))return;
      record({kind:'world',command:entry.command,kaiUPulse:pulse!,...(entry.card?{card:entry.card}:{}),...(groveMandate?{groveMandate}:{})});
    },[record]),
    async flush(){await persistence.current;if(error.current)throw Error(error.current);}
  };
}
