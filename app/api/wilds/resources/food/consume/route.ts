import { NextRequest, NextResponse } from "next/server";
const headers={"cache-control":"private, no-store"};
function failure(cause:unknown){const error=cause instanceof Error?cause.message:"wilds_resource_package_failed";return NextResponse.json({ok:false,error},{status:/^receiz_(?:conditional_resource_custody|admitted_food_source|resource_recipient_binding)_unavailable$/.test(error)?503:/authority_required/.test(error)?403:/invalid|required|missing/.test(error)?400:/unavailable|pending|consumed|exists|conflict|cancel/.test(error)?409:503,headers});}
import {executeWildsResourcePackageCommand} from "@/lib/receiz/wilds-resource-package-server";
import {sha256PortableBasis} from "@/features/play/portable-card";
export const runtime="nodejs";
export async function POST(request:NextRequest){try{const body=await request.json() as Record<string,unknown>;if(typeof body.itemId!=="string" || !body.itemId || body.itemId.length>800 || body.commandId!==undefined && typeof body.commandId!=="string")throw Error("wilds_resource_food_invalid");const commandId=typeof body.commandId==="string"?body.commandId:`food:consume:${sha256PortableBasis(body.itemId).slice(7)}`;return NextResponse.json({ok:true,world:await executeWildsResourcePackageCommand(request,{type:"resource.food.consume",itemId:body.itemId,commandId})},{headers});}catch(cause){return failure(cause);}}
