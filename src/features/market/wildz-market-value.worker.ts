import {calculateWildzMarketLocalValueV129,type WildzMarketLocalValueEvaluationV129} from './wildz-market-value-local-v129';
import type {PortableCardAsset} from '../play/portable-card';

/** Receives public game-sealed card inputs only. Native Receiz artifact
 * verification remains in the separate canonical v129 adapter. */
const scope=self as unknown as {
 addEventListener(type:'message',listener:(event:MessageEvent)=>void):void;
 postMessage(value:unknown):void;
};
let running=false;
scope.addEventListener('message',event=>{
 const request=event.data as {type?:unknown;requestId?:unknown;assetId?:unknown;card?:PortableCardAsset;evaluation?:WildzMarketLocalValueEvaluationV129};
 if(request?.type!=='read-value'||!Number.isSafeInteger(request.requestId)||typeof request.assetId!=='string'||!request.card||!request.evaluation)return;
 if(running){scope.postMessage({type:'value-result',requestId:request.requestId,result:{status:'unavailable',message:'The local value calculator is busy.'}});return;}
 if(request.card.id!==request.assetId){scope.postMessage({type:'value-result',requestId:request.requestId,result:{status:'unavailable',message:'The creature card does not match.'}});return;}
 running=true;
 void calculateWildzMarketLocalValueV129(request.card,request.evaluation).then(result=>{
  scope.postMessage({type:'value-result',requestId:request.requestId,result});
 },()=>scope.postMessage({type:'value-result',requestId:request.requestId,result:{status:'unavailable',message:'The local card value could not be calculated.'}}))
  .finally(()=>{running=false;});
});
