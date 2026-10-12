import type {WildzMarketServiceV128} from './wildz-market-service-v128';

/** A public read can finish after another surface or account wins. Reveal only
 * the exact service whose current first screen has finished preparation. */
export async function revealPreparedWildzMarket(input:Readonly<{
 service:WildzMarketServiceV128;
 current():WildzMarketServiceV128|null;
 isCurrent():boolean;
 ready(service:WildzMarketServiceV128):Promise<unknown>;
 reveal():void;
}>):Promise<boolean>{
 let service=input.service;
 while(input.isCurrent()){
  await input.ready(service).catch(()=>undefined);
  if(!input.isCurrent())return false;
  const current=input.current();if(!current)return false;
  if(current!==service){service=current;continue;}
  input.reveal();return true;
 }
 return false;
}
