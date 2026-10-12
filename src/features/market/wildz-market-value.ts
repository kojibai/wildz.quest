import type { ReceizProofValueProjectionV129, SigilMetadataLite, UnsignedSeal, ValuationLegacyDefault, SIGIL_VALUATION_ROUNDING } from '@receiz/sdk/valuation';

/** Display DTO for a canonical SDK projection or an explicitly labeled local
 * game-card model using the SDK law. A value grants no custody or payment. */
export type WildzMarketValuePoint=Readonly<{kaiUPulse:string;phiMicro:string;usdCents:string|null}>;
export type WildzMarketValueProjection=Readonly<{
 assetId:string;proofDigest:string;historyHead:string|null;algorithm:string;policyChecksum:string;projectionDigest:string;
 /** The local display runs the SDK law over the game's sealed card inputs.
  * It does not claim SDK native artifact admission or spendable Settlement. */
 valueSource?:'local-card-model';
 localModel?:Readonly<{
  source:Readonly<{originKind:'sealed-discovery-upulse'|'sealed-birth-timestamp-projection';originReference:string;cardSealKind:string;cardProofDigest:string;originKaiUPulse:string;originKaiPulse:string}>;
  metadata:SigilMetadataLite;unsigned:UnsignedSeal;appliedDefaults:readonly ValuationLegacyDefault[];
  unknownInputs:readonly string[];rounding:typeof SIGIL_VALUATION_ROUNDING;
 }>;
 /** Local proofDigest above selects the card; these identify its canonical seal. */
 proofArtifactDigest?:string;originProofDigest?:string;originKaiPulse?:string;
 sampleKind?:'recomputed-model-samples';sdkProjection?:ReceizProofValueProjectionV129;
 originKaiUPulse:string|null;valuationKaiUPulse:string;proofValuePhiMicro:string;marketReferenceValuePhiMicro:string|null;
 displayUsdCents:string|null;priceBasisDigest:string|null;
 samples:readonly WildzMarketValuePoint[];
 calculation:readonly Readonly<{id:string;label:string;formula:string;operands:Readonly<Record<string,string>>;result:string;unit:string;sourceReferences:readonly string[]}>[];
 replay?:Readonly<{filename:string;json:string}>;
}>;
export type WildzMarketValueRead=Readonly<{status:'ready';value:WildzMarketValueProjection}>|Readonly<{status:'unavailable';message:string}>;
export type WildzMarketValuePort=Readonly<{read(assetId:string):Promise<WildzMarketValueRead>;release?():void;dispose?():void}>;
export function formatWildzMarketKai(upulse:string){
 if(!/^(?:0|[1-9][0-9]{0,39})$/.test(upulse))return '☤KAI —';
 return `☤KAI ${(BigInt(upulse)/1_000_000n).toLocaleString('en-US')}`;
}
export function wildzMarketValueChange(points:readonly WildzMarketValuePoint[],unit:'phi'|'usd'){
 const ordered=wildzMarketValueGeometry(points,unit).points;if(ordered.length<2)return null;
 const first=ordered[0]!.point,last=ordered.at(-1)!.point,a=BigInt(unit==='usd'?first.usdCents!:first.phiMicro),b=BigInt(unit==='usd'?last.usdCents!:last.phiMicro);
 return a===0n?null:((b-a)*10000n/a).toString();
}
export function formatWildzMarketValueChange(bps:string){
 if(!/^-?(?:0|[1-9][0-9]{0,29})$/.test(bps))return '—';
 const n=BigInt(bps),abs=n<0n?-n:n;
 return `${n>0n?'+':n<0n?'-':''}${abs/100n}.${(abs%100n).toString().padStart(2,'0')}%`;
}

/** Exact integer geometry, including coordinates above Number's safe range.
 * Chart pixels are presentation; amounts and uPulse retain their exact bytes. */
export function wildzMarketValueGeometry(points:readonly WildzMarketValuePoint[],unit:'phi'|'usd'){
 const selected=points.filter(p=>/^(?:0|[1-9][0-9]*)$/.test(p.kaiUPulse)&&/^(?:0|[1-9][0-9]*)$/.test(unit==='phi'?p.phiMicro:p.usdCents??''));
 const unique=new Map(selected.map(p=>[p.kaiUPulse,p]));
 const ordered=[...unique.values()].sort((a,b)=>BigInt(a.kaiUPulse)<BigInt(b.kaiUPulse)?-1:BigInt(a.kaiUPulse)>BigInt(b.kaiUPulse)?1:0);
 if(!ordered.length)return {points:[],line:'',minimum:'0',maximum:'0'};
 const values=ordered.map(p=>BigInt(unit==='phi'?p.phiMicro:p.usdCents!)),minimum=values.reduce((a,b)=>a<b?a:b),maximum=values.reduce((a,b)=>a>b?a:b);
 const first=BigInt(ordered[0]!.kaiUPulse),last=BigInt(ordered.at(-1)!.kaiUPulse),span=last-first,range=maximum-minimum;
 const projected=ordered.map((p,index)=>({point:p,x:span?28+Number((BigInt(p.kaiUPulse)-first)*444000n/span)/1000:250,y:range?150-Number((values[index]!-minimum)*122000n/range)/1000:89}));
 return {points:projected,line:projected.map(p=>`${p.x},${p.y}`).join(' '),minimum:minimum.toString(),maximum:maximum.toString()};
}
