import {canonicalizeReceizV122,digestReceizCanonicalV122,quoteReceizDisplayUsdV122} from '@receiz/sdk';
import {computeIntrinsicUnsigned,stableStringify,SIGIL_VALUATION_ALGORITHM,SIGIL_VALUATION_POLICY_CHECKSUM,
 SIGIL_VALUATION_POLICY,SIGIL_VALUATION_ROUNDING,type SigilMetadataLite} from '@receiz/sdk/valuation';
import {verifyAnyWildsCard,type PortableCardAsset} from '../play/portable-card';
import {deriveKaiKlokMoment,deriveKaiKlokMomentFromUPulse} from '../play/kai-klok-moment';
import type {WildzMarketValueRead,WildzMarketValuePoint,WildzMarketValueProjection} from './wildz-market-value';

export type WildzMarketLocalValueEvaluationV129=Readonly<{
 valuationKaiUPulse:string;
 /** Already held explicit Receiz conversion rate. Reading a value never fetches a quote. */
 usdPerPhiMicrocents?:string|null;
}>;
const MAX_SAMPLES=32;
const unknownInputs=Object.freeze([
 'Craft quality and edition size are not carried as Sigil inputs; SDK compatibility defaults apply.',
 'Creator verification and reputation are unknown; SDK defaults do not assert either fact.',
 'Creature growth, game rarity, transfers and sales are not Sigil valuation inputs or admitted native sale evidence.',
 'This local card model does not establish canonical Receiz artifact admission, custody or Settlement.'
]);
function coordinate(value:unknown):bigint {
 if(typeof value!=='string'||!/^(?:0|[1-9][0-9]{0,15})$/.test(value))throw Error('LOCAL_VALUE_COORDINATE_INVALID');
 const result=BigInt(value);if(result>BigInt(Number.MAX_SAFE_INTEGER))throw Error('LOCAL_VALUE_COORDINATE_INVALID');
 return result;
}
function sourceInput(card:PortableCardAsset){
 if(!verifyAnyWildsCard(card).ok)throw Error('LOCAL_VALUE_CARD_SEAL_INVALID');
 const manifest=card.manifest;
 const living=manifest.schema==='receiz.wilds_living_card_manifest.v2';
 const variant=living?manifest.birthGenome.variant:manifest.variant.traits;
 const discovery=(variant as {identity?:{discovery?:{kaiPulse?:unknown}}}).identity?.discovery;
 // V3 discovery.kaiPulse was authored from moment.uPulse despite its legacy
 // field name. Never pass this micro-pulse integer into the whole-pulse law.
 const carried=discovery?.kaiPulse;
 const exact=typeof carried==='number'&&Number.isSafeInteger(carried)&&carried>=0;
 const moment=exact?deriveKaiKlokMomentFromUPulse({uPulse:carried,authority:'local'})
  :deriveKaiKlokMoment({occurredAt:living?manifest.birth.bornAt:manifest.capturedAt,authority:'local'});
 const originKaiUPulse=String(moment.uPulse),originKaiPulse=String(moment.pulse);
 const metadata:SigilMetadataLite={kaiPulse:moment.pulse,beat:moment.beat,stepIndex:moment.stepIndex,
  stepsPerBeat:44,chakraDay:moment.chakra,chakraGate:moment.gate};
 // Do not translate catalog rarity, creature size, wins or status into craft
 // quality, creator reputation, edition size, holders, transfers or cashflows.
 const source={originKind:exact?'sealed-discovery-upulse' as const:'sealed-birth-timestamp-projection' as const,
  originReference:exact?(living?'manifest.birthGenome.variant.identity.discovery.kaiPulse':'manifest.variant.traits.identity.discovery.kaiPulse')
   :living?'manifest.birth.bornAt':'manifest.capturedAt',
  cardSealKind:card.proof.kind,cardProofDigest:card.proof.digest,originKaiUPulse,originKaiPulse};
 return {metadata,source};
}
function phiMicro(valuePhi:number){
 // Preserve the SDK's published binary64 law and display rounding verbatim.
 // BigInt converts the rounded integer; it never adds precision to the law.
 const rounded=Math.round(valuePhi*1_000_000);
 if(!Number.isSafeInteger(rounded)||rounded<0)throw Error('LOCAL_VALUE_AMOUNT_INVALID');
 return BigInt(rounded).toString();
}

/** The actual SDK129 pure law, with a game-seal source boundary. This is a
 * read-only local model and deliberately never fabricates an SDK projection,
 * verified artifact digest, native history, payment or proof-root publication. */
export async function calculateWildzMarketLocalValueV129(card:PortableCardAsset,evaluation:WildzMarketLocalValueEvaluationV129):Promise<WildzMarketValueRead>{
 try{
  const at=coordinate(evaluation.valuationKaiUPulse),{metadata,source}=sourceInput(card),origin=coordinate(source.originKaiUPulse);
  if(at<origin)throw Error('LOCAL_VALUE_EVALUATION_BEFORE_ORIGIN');
  const rate=evaluation.usdPerPhiMicrocents??null;
  if(rate!==null&&(typeof rate!=='string'||!/^[1-9][0-9]{0,29}$/.test(rate)))throw Error('LOCAL_VALUE_USD_RATE_INVALID');
  const usdBasis=rate===null?null:{algorithm:'receiz.display-usd.v122',version:'1',usdPerPhiMicrocents:rate,
   source:'held-receiz-display-rate',authority:'display-conversion-only'};
  const priceBasisDigest=usdBasis?await digestReceizCanonicalV122(usdBasis):null;
  const convert=(amount:string)=>rate===null?null:amount==='0'?'0':quoteReceizDisplayUsdV122(amount,rate);
  const coordinates=[...new Set(Array.from({length:MAX_SAMPLES},(_,index)=>{
   const selected=at-BigInt(MAX_SAMPLES-1-index)*1_000_000n;return (selected<origin?origin:selected).toString();
  }))];
  // Each point is independently recomputed, with no interpolated price or
  // invented transaction. Exact uPulse remains in the point and replay.
  const samples:WildzMarketValuePoint[]=coordinates.map(kaiUPulse=>{
   const computation=computeIntrinsicUnsigned(metadata,Number(BigInt(kaiUPulse)/1_000_000n));
   const amount=phiMicro(computation.unsigned.valuePhi);
   return {kaiUPulse,phiMicro:amount,usdCents:convert(amount)};
  });
  const computation=computeIntrinsicUnsigned(metadata,Number(at/1_000_000n));
  const proofValuePhiMicro=phiMicro(computation.unsigned.valuePhi),displayUsdCents=convert(proofValuePhiMicro);
  const localModel={source,metadata,unsigned:computation.unsigned,appliedDefaults:computation.appliedDefaults,unknownInputs,rounding:SIGIL_VALUATION_ROUNDING};
  const calculation=[...computation.calculation];
  if(rate!==null)calculation.push({id:'displayUsdCents',label:'USD display conversion',
   formula:'floor((proofValuePhiMicro * usdPerPhiMicrocents + 500000000000) / 1000000000000)',
   operands:{proofValuePhiMicro,usdPerPhiMicrocents:rate},result:displayUsdCents!,unit:'USD cents',
   sourceReferences:[priceBasisDigest!,'@receiz/sdk#quoteReceizDisplayUsdV122']});
  const replay={schema:'wildz.local-card-value-replay.v129',valueSource:'local-card-model',assetId:card.id,
   source,algorithm:SIGIL_VALUATION_ALGORITHM,policyChecksum:SIGIL_VALUATION_POLICY_CHECKSUM,policy:SIGIL_VALUATION_POLICY,
   rounding:SIGIL_VALUATION_ROUNDING,valuationKaiUPulse:evaluation.valuationKaiUPulse,
   valuationKaiPulse:(at/1_000_000n).toString(),sampleKind:'recomputed-model-samples',
   inputs:{metadata,appliedDefaults:computation.appliedDefaults,unknownInputs,usdBasis,priceBasisDigest},
   unsigned:computation.unsigned,stampPayload:computation.stampPayload,proofValuePhiMicro,displayUsdCents,samples,calculation,writesPerformed:0};
  // The existing unsigned SDK result contains optional undefined head fields.
  // Preserve its documented JSON number serialization before strict canonical
  // digesting; no math or policy value is changed by this wire snapshot.
  const publicReplay=JSON.parse(stableStringify(replay)) as typeof replay;
  const projectionDigest=await digestReceizCanonicalV122(publicReplay);
  const value:WildzMarketValueProjection={assetId:card.id,proofDigest:card.proof.digest,historyHead:null,
   algorithm:SIGIL_VALUATION_ALGORITHM,policyChecksum:SIGIL_VALUATION_POLICY_CHECKSUM,projectionDigest,
   valueSource:'local-card-model',localModel,originKaiUPulse:source.originKaiUPulse,originKaiPulse:source.originKaiPulse,
   valuationKaiUPulse:evaluation.valuationKaiUPulse,proofValuePhiMicro,marketReferenceValuePhiMicro:null,
   displayUsdCents,priceBasisDigest,sampleKind:'recomputed-model-samples',samples,calculation,
   replay:{filename:`wildz-local-value-${card.id.replace(/^wilds:/,'')}-v129.json`,json:canonicalizeReceizV122({...publicReplay,projectionDigest})}};
  return {status:'ready',value};
 }catch(cause){
  const message=cause instanceof Error&&/^LOCAL_VALUE_[A-Z_]+$/.test(cause.message)?cause.message:'LOCAL_VALUE_INPUT_INVALID';
  return {status:'unavailable',message:`The local card value is unavailable. Reference: ${message}.`};
 }
}
