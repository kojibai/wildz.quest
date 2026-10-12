import {canonicalPortableCardJson,sha256PortableBasis} from '../../features/play/portable-card';
import {admitWildzMarketConnectQuoteV128,deriveWildzMarketConnectQuoteV128,sameWildzMarketConnectQuoteV128,type WildzMarketConnectQuoteV128} from './wildz-market-quote-v128';
import {validateWildzCardCheckoutUrlV128} from './wildz-card-checkout-url-v128';
export {validateWildzCardCheckoutUrlV128} from './wildz-card-checkout-url-v128';

export type WildzMarketFundingRequestV128=Readonly<{action:'create'|'check'|'read';purchaseId:string;quote:WildzMarketConnectQuoteV128;sessionId?:string;topupUsdCents?:string}>;
export type WildzMarketFundingResultV128=Readonly<{status:'ready'|'checkout'|'pending'|'expired'|'review-required';message:string;sessionId?:string;checkoutUrl?:string;topupUsdCents?:string}>;
export type WildzMarketFundingDependenciesV128=Readonly<{
 currentKai():number;origin:string;returnPath?:'/'|'/market';walletSummary():Promise<unknown>;
 checkout(input:Readonly<{amountUsd:string;currency:'usd';uiMode:'hosted';referenceId:string;description:string;successUrl:string;cancelUrl:string}>):Promise<unknown>;
 checkoutSession(input:Readonly<{sessionId:string}>):Promise<unknown>;
}>;
const object=(value:unknown):value is Record<string,unknown>=>!!value&&typeof value==='object'&&!Array.isArray(value);
const unsigned=(value:unknown):value is string=>typeof value==='string'&&/^(?:0|[1-9][0-9]{0,29})$/.test(value);
const sessionId=(value:unknown):value is string=>typeof value==='string'&&/^cs_[a-zA-Z0-9_]{8,200}$/.test(value);
const positiveCents=(value:unknown):value is string=>unsigned(value)&&BigInt(value)>=50n&&BigInt(value)<=10_000_000n;
export function wildzMarketFundingReferenceV128(ownerHandle:string,purchaseId:string,quote:WildzMarketConnectQuoteV128){
 return 'wildz:market:'+sha256PortableBasis(canonicalPortableCardJson({ownerHandle,purchaseId,quote})).replace(/^sha256:/,'');
}
function admitRequest(value:WildzMarketFundingRequestV128){
 const keys=Object.keys(value).sort().join(',');
 if(!object(value)||!/^market:purchase:[a-f0-9]{64}$/.test(value.purchaseId)
  ||(value.action==='create'||value.action==='read'?keys!=='action,purchaseId,quote':value.action!=='check'||keys!=='action,purchaseId,quote,sessionId,topupUsdCents'||!sessionId(value.sessionId)||!positiveCents(value.topupUsdCents)))throw Error('The exact saved purchase checkout is required.');
 return admitWildzMarketConnectQuoteV128(value.quote);
}

/** Receiz checkout funds the authenticated buyer's wallet. Card status never
 * substitutes for the subsequent seller payment or native asset acceptance. */
export async function prepareWildzMarketFundingV128(request:WildzMarketFundingRequestV128,owner:Readonly<{ownerReceizId:string;profileHandle:string}>,deps:WildzMarketFundingDependenciesV128):Promise<WildzMarketFundingResultV128>{
 const quote=admitRequest(request);
 if(quote.ownerHandle!==owner.profileHandle)throw Error('The checkout belongs to another buyer.');
 const referenceId=wildzMarketFundingReferenceV128(owner.profileHandle,request.purchaseId,quote);
 let checked:Record<string,unknown>|null=null;
 if(request.action==='check'){
  const response=await deps.checkoutSession({sessionId:request.sessionId!});
  if(!object(response)||response.ok!==true||!object(response.session))throw Error('The original card checkout could not be checked.');
  checked=response.session;
  if(checked.sessionId!==request.sessionId||checked.referenceId!==referenceId||checked.currency!=='usd'||checked.amountUsdCents!==request.topupUsdCents)throw Error('The card checkout differs from this saved purchase.');
  if(checked.isPaid===true&&(!object(response.settlement)||response.settlement.userId!==owner.ownerReceizId||response.settlement.amountUsdCents!==request.topupUsdCents||!unsigned(response.settlement.amountPhiMicro)||BigInt(response.settlement.amountPhiMicro)===0n))throw Error('The card checkout settlement belongs to another buyer or amount.');
 }
 const wallet=await deps.walletSummary(),actual=deriveWildzMarketConnectQuoteV128(wallet,{ownerUserId:owner.ownerReceizId,ownerHandle:owner.profileHandle,priceUsdCents:quote.priceUsdCents,currentKai:deps.currentKai()});
 if(quote.expiresAtKai<=deps.currentKai()||!sameWildzMarketConnectQuoteV128(quote,actual))return {status:'review-required',message:checked?.isPaid===true?'Your card funded your wallet. Review the current price and Phi amount before approving this purchase.':'Review the current price and Phi amount before opening card checkout.'};
 const balance=(wallet as {wallet:{balancePhiMicro:string}}).wallet.balancePhiMicro;
 if(BigInt(balance)>=BigInt(quote.amountPhiMicro))return {status:'ready',message:'Your wallet covers the exact purchase. Payment and delivery still require their original approvals.'};
 if(request.action==='read')return {status:'pending',message:'Your wallet is short. Open Market and resume this purchase to fund your wallet by card.'};
 if(checked){
  if(checked.state==='expired')return {status:'expired',message:'This card checkout expired. No purchase payment was sent. Approve again to open a new checkout.'};
  if(checked.isPaid===true)return {status:'pending',message:'Your card payment is confirmed. Check this same purchase again while the spendable wallet balance updates.'};
  if(checked.state==='open'&&typeof checked.checkoutUrl==='string')return {status:'checkout',message:'Your wallet is short. Continue the same saved card checkout; funds stay in your wallet until you approve the purchase.',sessionId:request.sessionId,topupUsdCents:request.topupUsdCents,checkoutUrl:validateWildzCardCheckoutUrlV128(checked.checkoutUrl)};
  return {status:'pending',message:'The original card checkout has not funded your wallet. Check this same session before creating another.'};
 }
 // Round the missing native value up to USD cents, respecting the provider's
 // 50-cent minimum. Excess funding remains in the buyer's wallet.
 const missing=BigInt(quote.amountPhiMicro)-BigInt(balance);
 const cents=(missing*BigInt(quote.usdPerPhiMicrocents)+999_999_999_999n)/1_000_000_000_000n;
 const topup=cents<50n?50n:cents;
 if(topup>10_000_000n)throw Error('The missing funds exceed the card checkout maximum of $100,000. Fund your wallet before approving this purchase.');
 const returnUrl=new URL(deps.returnPath==='/market'?'/market':'/',deps.origin);returnUrl.searchParams.set('marketPurchase',request.purchaseId);
 const success=new URL(returnUrl);success.searchParams.set('cardCheckout','returned');
 const cancel=new URL(returnUrl);cancel.searchParams.set('cardCheckout','cancelled');
 const response=await deps.checkout({amountUsd:`${topup/100n}.${(topup%100n).toString().padStart(2,'0')}`,currency:'usd',uiMode:'hosted',referenceId,
  description:'Fund your Receiz wallet for a Wildz Market purchase',successUrl:success.toString(),cancelUrl:cancel.toString()});
 if(!object(response)||response.ok!==true||!object(response.checkout))throw Error('The card checkout response is uncertain. Check your wallet before trying again.');
 const checkout=response.checkout;
 if(checkout.mode!=='hosted'||!sessionId(checkout.sessionId)||checkout.amountUsdCents!==topup.toString()||checkout.currency!=='usd'||checkout.referenceId!==referenceId)throw Error('The hosted card checkout response does not match this purchase.');
 return {status:'checkout',sessionId:checkout.sessionId,checkoutUrl:validateWildzCardCheckoutUrlV128(checkout.url),topupUsdCents:topup.toString(),message:`Your wallet is short. Card checkout adds $${topup/100n}.${(topup%100n).toString().padStart(2,'0')} to your wallet. Return to Market to approve payment and receive the asset.`};
}
