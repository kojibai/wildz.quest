import {NextRequest,NextResponse} from 'next/server';
import {RECEIZ_DEFAULT_BASE_URL} from '@receiz/sdk';
import {isWildsClearancePublicUrlV128} from '@/lib/receiz/wilds-clearance-public-read-v128';
import {WILDZ_RECEIZ_APPLICATION_ID} from '@/lib/receiz/wildz-application';
export const runtime='nodejs';
export const dynamic='force-dynamic';
const headers={'cache-control':'no-store'};
/** Signer-free byte transport, restricted to the one public resource family.
 * No wallet context, session, bearer token, mutation or caller-supplied host. */
export async function GET(request:NextRequest){
 try{
  const params=request.nextUrl.searchParams;
  if(!params.size)return NextResponse.json({applicationId:WILDZ_RECEIZ_APPLICATION_ID},{headers});
  const source=params.get('url')??'';
  if(params.size!==1||!isWildsClearancePublicUrlV128(source))return NextResponse.json({error:'wilds_clearance_public_path_invalid'},{status:400,headers});
  const origin=new URL(process.env.RECEIZ_BASE_URL||RECEIZ_DEFAULT_BASE_URL).origin;
  const url=new URL('/api/public-proof/by-url',origin);url.searchParams.set('url',source);
  const upstream=await fetch(url,{method:'GET',headers:{accept:'application/json'},cache:'no-store',redirect:'error',signal:request.signal});
  // Published byte pages and locator records already have strict SDK limits;
  // bound transport before constructing the response body as well.
  const reader=upstream.body?.getReader(),chunks:Uint8Array[]=[];let bytes=0;
  if(reader)try{for(;;){const next=await reader.read();if(next.done)break;bytes+=next.value.byteLength;if(bytes>2_000_000)throw Error('wilds_clearance_public_response_too_large');chunks.push(next.value);}}finally{await reader.cancel();}
  const body=new Uint8Array(bytes);let offset=0;for(const chunk of chunks){body.set(chunk,offset);offset+=chunk.length;}
  return new Response(body,{status:upstream.status,headers:{...headers,'content-type':'application/json'}});
 }catch{return NextResponse.json({error:'wilds_clearance_public_unavailable'},{status:503,headers});}
}
