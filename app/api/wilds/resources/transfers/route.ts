import { NextRequest, NextResponse } from "next/server";
import { createWildsResourcePackageFromInventory, prepareWildsResourcePackageTransfer } from "@/lib/receiz/wilds-resource-package-server";
import { worldSnapshot } from "@/lib/receiz/wilds-world-server";
import { canonicalPortableCardJson } from "@/features/play/portable-card";
export const runtime="nodejs";
export async function POST(request:NextRequest){
  try{
    const body=await request.json() as Record<string,unknown>,snapshot=(await worldSnapshot(request)).projection;
    const material=body.materialLot!==undefined,candidate=(material?body.materialLot:body.resourceLot) as {lotId?:unknown};
    if(!candidate || typeof candidate.lotId!=="string")throw Error("wilds_resource_transfer_lot_invalid");
    const id=candidate.lotId,source=material?snapshot.materialLots[id]:snapshot.resourceLots[id];
    if(!source || canonicalPortableCardJson(source)!==canonicalPortableCardJson(candidate))throw Error("wilds_resource_transfer_lot_invalid");
    let packageId=(material?snapshot.reservedMaterialLots[id]:snapshot.reservedResourceLots?.[id]);
    if(packageId && !snapshot.resourcePackages?.[packageId])throw Error("wilds_resource_package_member_unavailable");
    if(!packageId){
      const custody=material?snapshot.materialCustody[id]:snapshot.resourceCustody[id];
      const prepared=await createWildsResourcePackageFromInventory(request,{materialLotIds:material?[id]:[],resourceLotIds:material?[]:[id],commandId:`resource:card:${id.slice(-64)}:${custody?.transferId?.slice(-24)??"source"}`});
      packageId=prepared.package.packageId;
    }
    const result=await prepareWildsResourcePackageTransfer(request,{packageId,targetHandle:typeof body.targetHandle==="string"?body.targetHandle:null});
    return NextResponse.json({ok:true,...result},{headers:{"cache-control":"private, no-store"}});
  }catch(cause){const error=cause instanceof Error?cause.message:"wilds_resource_transfer_failed";return NextResponse.json({ok:false,error},{status:/^receiz_(?:conditional_resource_custody|admitted_food_source|resource_recipient_binding)_unavailable$/.test(error)?503:/authority_required/.test(error)?403:/invalid|missing/.test(error)?400:/unavailable|pending|conflict/.test(error)?409:503,headers:{"cache-control":"private, no-store"}});}
}
