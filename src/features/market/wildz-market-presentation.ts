/** A USD entry is selection input, never a wallet quote or payment authority. */
export function parseWildzMarketUsdInput(value:string):string|null {
 const trimmed=value.trim(),normalized=trimmed.startsWith('.')?`0${trimmed}`:trimmed;
 if(!/^(?:0|[1-9][0-9]{0,23})(?:\.[0-9]{1,2})?$/.test(normalized))return null;
 const [whole,fraction='']=normalized.split('.');
 const cents=`${whole}${fraction.padEnd(2,'0')}`.replace(/^0+(?=\d)/,'');
 return cents==='0'?null:cents;
}

export type WildzMarketUiActionState=Readonly<{busy:string|null;message:string;error:boolean}>;

export type WildzMarketListingUiAttempt=Readonly<{
 request:Parameters<WildzMarketServiceV128['list']>[0];title:string;summary:string
}>;
// This cache retains only the display request across panel close/reopen. The
// service owns durable recovery and must re-admit every subsequent action.
const listingUiAttempts=new WeakMap<WildzMarketServiceV128,WildzMarketListingUiAttempt>();
export const readWildzMarketListingUiAttempt=(service:WildzMarketServiceV128)=>listingUiAttempts.get(service)??null;
export function retainWildzMarketListingUiAttempt(service:WildzMarketServiceV128,input:WildzMarketListingUiAttempt):WildzMarketListingUiAttempt {
 const held=listingUiAttempts.get(service);
 if(held)return held;
 const exact=structuredClone(input);listingUiAttempts.set(service,exact);return exact;
}
export function releaseWildzMarketListingUiAttempt(service:WildzMarketServiceV128,attemptId:string){
 if(listingUiAttempts.get(service)?.request.attemptId===attemptId)listingUiAttempts.delete(service);
}

/** Serialize gestures only. Source, payment and recovery authority stay in the service. */
export function createWildzMarketUiActionRuntime(input:Readonly<{isCurrent():boolean;onChange(state:WildzMarketUiActionState):void}>) {
 let state:WildzMarketUiActionState={busy:null,message:'',error:false};
 const update=(next:WildzMarketUiActionState)=>{state=next;if(input.isCurrent())input.onChange(state);};
 return {
  snapshot:()=>state,
  notice(message:string,error=false){if(input.isCurrent())update({...state,message,error});},
  async run<T>(label:string,action:()=>Promise<T>):Promise<T|undefined>{
   if(state.busy||!input.isCurrent())return undefined;
   update({busy:label,message:'',error:false});
   try{const result=await action();return input.isCurrent()?result:undefined;}
   catch(cause){if(input.isCurrent())update({...state,message:cause instanceof Error?cause.message:'This response could not be confirmed. Continue the same action.',error:true});return undefined;}
   finally{if(input.isCurrent())update({...state,busy:null});}
  }
 };
}
import type {WildzMarketServiceV128} from './wildz-market-service-v128';
