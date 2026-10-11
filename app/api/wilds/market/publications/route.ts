import {NextRequest,NextResponse} from 'next/server';
import {createReceizClient,digestReceizCanonicalV122,ReceizHttpError} from '@receiz/sdk';
import {isWildzMarketPublicationUrlV128,parseSignedWildzMarketPublicationV128,WILDZ_MARKET_PUBLICATION_NAMESPACE_V128} from '@/lib/receiz/wildz-market-publication-v128';
import {receizHttpFailureCode} from '@/lib/receiz/receiz-http-failure';

export const runtime='nodejs';
export const dynamic='force-dynamic';
const headers={'cache-control':'no-store'};
const maxBytes=1_000_000;
function client(){return createReceizClient({baseUrl:process.env.RECEIZ_BASE_URL??'https://receiz.com'});}
function failed(cause:unknown){
 const payload=cause instanceof ReceizHttpError?cause.payload as {error?:unknown}|null:null;
 const lower=typeof payload?.error==='string'&&/^[a-z][a-z0-9_]{2,100}$/.test(payload.error)?payload.error:undefined;
 return NextResponse.json({ok:false,error:receizHttpFailureCode(cause)??lower??'wildz_market_publication_failed'},
  {status:cause instanceof ReceizHttpError&&[400,401,403,409,413,429].includes(cause.status)?cause.status:503,headers});
}

/** Public discovery only; caller cookies and Wallet tokens are never relayed. */
export async function GET(request:NextRequest){
 const query=request.nextUrl.searchParams,source=query.get('url');
 if(query.size&&(!source||query.size!==1||!isWildzMarketPublicationUrlV128(source)))return NextResponse.json({ok:false,error:'wildz_market_publication_path_invalid'},{status:400,headers});
 try{
 const sdk=client(),result=source?await sdk.appState.byUrl(source):await sdk.appState.byNamespace(WILDZ_MARKET_PUBLICATION_NAMESPACE_V128);
 if(new TextEncoder().encode(JSON.stringify(result)).length>maxBytes)throw Error('wildz_market_publication_read_too_large');
 return NextResponse.json(result,{headers});
}catch(cause){return failed(cause);}}

/** Same Identity Seal signed-public-store rail as Profile. Receiz verifies the
 * signer and owner. This route bounds its namespace and never grants custody. */
export async function POST(request:NextRequest){
 let bytes=0;const chunks:Uint8Array[]=[];
 if(!request.body)return NextResponse.json({ok:false,error:'wildz_market_publication_invalid'},{status:400,headers});
 const reader=request.body.getReader();
 try{while(true){const part=await reader.read();if(part.done)break;bytes+=part.value.length;if(bytes>maxBytes){await reader.cancel();return NextResponse.json({ok:false,error:'wildz_market_publication_too_large'},{status:413,headers});}chunks.push(part.value);}}
 finally{reader.releaseLock();}
 let signed:unknown,record:ReturnType<typeof parseSignedWildzMarketPublicationV128>;
 try{const body=new Uint8Array(bytes);let offset=0;for(const chunk of chunks){body.set(chunk,offset);offset+=chunk.length;}signed=JSON.parse(new TextDecoder().decode(body));record=parseSignedWildzMarketPublicationV128(signed);}
 catch{return NextResponse.json({ok:false,error:'wildz_market_publication_invalid'},{status:400,headers});}
 try{
  const sdk=client();const result=await sdk.publicStore.publishSigned(signed as Parameters<typeof sdk.publicStore.publishSigned>[0],
   {idempotencyKey:`wildz:market-publication:${await digestReceizCanonicalV122(record)}`});
  if(result.ok!==true||!result.appendAnchorId||result.knownHead?.appendAnchorId!==result.appendAnchorId)throw Error('wildz_market_publication_unconfirmed');
  return NextResponse.json(result,{status:201,headers});
 }catch(cause){return failed(cause);}
}
