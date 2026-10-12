/** Public card coordinates require only the complete object's immutable id. */
export function standaloneCardUrl(assetId:string,origin:string){
 const base=new URL(origin);
 if(base.protocol!=="https:"&&base.protocol!=="http:")throw Error("wilds_card_origin_invalid");
 if(!/^wilds:[a-f0-9]{24}$/.test(assetId))throw Error("wilds_card_id_invalid");
 return new URL(`/cards/${encodeURIComponent(assetId)}`,base.origin).toString();
}
