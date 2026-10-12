import {NextRequest,NextResponse} from 'next/server';
import {createReceizClient} from '@receiz/sdk';
import {WILDZ_MARKET_COLLECTION_NAMESPACE,projectWildzMarketCollection,projectWildzMarketTransfers,wildzMarketClaimProfileHandles,wildzMarketCollectionUrl} from '@/lib/receiz/wildz-market-collection';
import {WILDZ_OWNERSHIP_SYNC_NAMESPACE} from '@/lib/receiz/wildz-ownership-reconcile';
import {parsePublicWildzProfileRecord} from '@/lib/receiz/wildz-profile-record';
import {canonicalWildzProfilePath} from '@/features/profile/public-profile';
import {WILDZ_PRODUCT} from '@/lib/wildz/product';

export const runtime='nodejs';
export const dynamic='force-dynamic';
const headers={'cache-control':'no-store'};
/** Anonymous, bounded public projection reads. No identity/write session is opened. */
export async function GET(request:NextRequest){
 try{
  const sdk=createReceizClient({baseUrl:process.env.RECEIZ_BASE_URL??'https://receiz.com'});
  const owner=request.nextUrl.searchParams.get('owner');
  if(request.nextUrl.searchParams.size>(owner?1:0))return NextResponse.json({ok:false,error:'wildz_market_collection_query_invalid'},{status:400,headers});
  if(owner){const result=await sdk.appState.byUrl(wildzMarketCollectionUrl(owner));return NextResponse.json({ok:true,profile:parsePublicWildzProfileRecord(result)?.profile??null},{headers});}
  const [directory,ownership]=await Promise.all([sdk.appState.byNamespace(WILDZ_MARKET_COLLECTION_NAMESPACE),sdk.appState.byNamespace(WILDZ_OWNERSHIP_SYNC_NAMESPACE)]);
  if(!directory.ok||!ownership.ok||directory.records.length>5000||ownership.records.length>100000)throw Error('wildz_market_collection_read_failed');
  const profiles=directory.records.flatMap(row=>{
   const record=parsePublicWildzProfileRecord(row);
   return record&&row.sourceUrl===wildzMarketCollectionUrl(record.handle)&&row.externalCreatorId===record.handle.replace(/^@/,'')+'.receiz.id'?[record]:[];
  });
  // Existing claims provide discoverable owner handles while older profiles
  // have not yet published their new directory entry. Re-read their current gallery.
  const missing=wildzMarketClaimProfileHandles(ownership.records).filter(handle=>!profiles.some(profile=>profile.handle===`@${handle.replace(/\.receiz\.id$/,'')}`));
  for(let offset=0;offset<Math.min(missing.length,1000);offset+=8){
   const rows=await Promise.allSettled(missing.slice(offset,offset+8).map(handle=>sdk.appState.byUrl(`${WILDZ_PRODUCT.origin}${canonicalWildzProfilePath(handle.replace(/\.receiz\.id$/,''))}`)));
   for(const row of rows)if(row.status==='fulfilled'){const profile=parsePublicWildzProfileRecord(row.value);if(profile)profiles.push(profile);}
  }
  const cards=projectWildzMarketCollection(profiles,ownership.records);
  return NextResponse.json({ok:true,cards,transfers:projectWildzMarketTransfers(ownership.records,cards)},{headers});
 }catch{return NextResponse.json({ok:false,error:'wildz_market_collection_unavailable'},{status:503,headers});}
}
