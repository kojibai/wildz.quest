/** Hosted checkout navigation is restricted to Stripe's HTTPS checkout host. */
export function validateWildzCardCheckoutUrlV128(value:unknown){
 if(typeof value!=='string')throw Error('The hosted card checkout URL is missing.');
 const url=new URL(value);
 if(url.protocol!=='https:'||url.hostname!=='checkout.stripe.com'||url.port||url.username||url.password)throw Error('The hosted card checkout URL is invalid.');
 return url.toString();
}
