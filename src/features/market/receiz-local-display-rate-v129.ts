import {digestReceizCanonicalV122} from '@receiz/sdk';
import type {SigilMetadataLite} from '@receiz/sdk/valuation';
import {DEFAULT_ISSUANCE_POLICY,quotePhiForUsd} from './receiz-display-issuance-v129';

const POLICY_SOURCE_SHA256='69622c017e955734525e121a7b27bdaa42066932657b145e02be493792de9c74';
function freeze<T>(value:T):T{
 if(value&&typeof value==='object'){
  Object.freeze(value);
  for(const item of Object.values(value))freeze(item);
 }
 return value;
}
const policy=freeze(DEFAULT_ISSUANCE_POLICY);
// These are the exact anonymous context operands from Receiz Wallet's
// app/lib/wallet/amounts.ts, not a creature's metadata or a user's balance.
const rateMetadata=freeze({ip:{expectedCashflowPhi:[]}}) as unknown as SigilMetadataLite;
let policyChecksum:Promise<string>|null=null;
function compute(pulse:number){
 const context={meta:rateMetadata,nowPulse:pulse,usd:100,currentStreakDays:0,lifetimeUsdSoFar:0,plannedHoldBeats:0};
 const quote=quotePhiForUsd(context,policy);
 if(!Number.isFinite(quote.usdPerPhi)||quote.usdPerPhi<=0)throw Error('LOCAL_VALUE_USD_RATE_INVALID');
 // Receiz Wallet rounds the quote to eight USD decimals before converting
 // dollars to microcents (100 * 1e6). The integer bridge is identical.
 const text=quote.usdPerPhi.toFixed(8);
 if(!/^\d+\.\d{8}$/.test(text))throw Error('LOCAL_VALUE_USD_RATE_INVALID');
 const usdPerPhiMicrocents=BigInt(text.replace('.','')).toString();
 if(!/^[1-9][0-9]{0,29}$/.test(usdPerPhiMicrocents))throw Error('LOCAL_VALUE_USD_RATE_INVALID');
 return freeze({pulse,context,quote,usdPerPhiMicrocents});
}
// At most one shared whole-pulse computation is retained, independent of
// identity, card count and Wallet freshness. No timer or transport exists.
let cached:ReturnType<typeof compute>|null=null;

export async function calculateReceizLocalDisplayRateV129(valuationKaiUPulse:string){
 if(!/^(?:0|[1-9][0-9]{0,15})$/.test(valuationKaiUPulse))throw Error('LOCAL_VALUE_COORDINATE_INVALID');
 const exact=BigInt(valuationKaiUPulse);
 if(exact>BigInt(Number.MAX_SAFE_INTEGER))throw Error('LOCAL_VALUE_COORDINATE_INVALID');
 const pulse=Number(exact/1_000_000n);
 const selected=cached?.pulse===pulse?cached:(cached=compute(pulse));
 policyChecksum??=digestReceizCanonicalV122(policy);
 return {
  schema:'wildz.receiz-local-display-rate.v129',algorithm:'receiz.wallet.default-issuance-display.v1',
  authority:'display-conversion-only',valuationKaiUPulse,valuationKaiPulse:String(pulse),
  usdPerPhiMicrocents:selected.usdPerPhiMicrocents,context:selected.context,quote:selected.quote,
  policy,policyChecksum:await policyChecksum,policySourceSha256:POLICY_SOURCE_SHA256,
  rounding:'Receiz quote (9 decimal digits) -> USD/Φ toFixed(8) -> integer microcents',writesPerformed:0
 } as const;
}
