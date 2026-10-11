import {NextRequest,NextResponse} from 'next/server';
import {receizKaiNow} from '@receiz/sdk';
import {createReceizCommerceAdapter} from '@/lib/receiz/adapter';
import {resolveWildzMarketFundingAuthority,wildsWalletAuthorityStatusFor} from '@/lib/receiz/wilds-wallet-route-authority';
import {canonicalWildzAppOrigin} from '@/lib/receiz/wildz-auth-url';
import {prepareWildzMarketFundingV128,type WildzMarketFundingRequestV128} from '@/lib/receiz/wildz-market-funding-v128';

export const runtime='nodejs';
export const dynamic='force-dynamic';
const headers={'cache-control':'private, no-store'};
export async function POST(request:NextRequest){
 let checkoutDispatched=false;
 try{
  const origin=canonicalWildzAppOrigin(request.nextUrl.origin);
  if(request.headers.get('origin')!==origin)throw Error('The card checkout must start from Wildz.');
  const authority=await resolveWildzMarketFundingAuthority(request);
  const text=await request.text();if(text.length>4096)throw Error('The saved purchase checkout request is too large.');
  const adapter=createReceizCommerceAdapter({accessToken:authority.accessToken});
  const result=await prepareWildzMarketFundingV128(JSON.parse(text) as WildzMarketFundingRequestV128,authority,{
   origin,currentKai:()=>receizKaiNow().pulse,walletSummary:()=>adapter.walletSummary(),checkoutSession:input=>adapter.checkoutSession(input),
   checkout:input=>{checkoutDispatched=true;return adapter.checkout(input);}
  });
  return NextResponse.json(result,{headers});
 }catch(cause){
  const message=cause instanceof Error?cause.message:'The original card checkout is unavailable.';
  return NextResponse.json({error:message,checkoutDispatched},{status:message.startsWith('receiz_wallet_')?wildsWalletAuthorityStatusFor(message):409,headers});
 }
}
