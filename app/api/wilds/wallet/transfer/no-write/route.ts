import { NextRequest } from "next/server";
import { createWildsWalletRouteHandlers } from "@/lib/receiz/wilds-wallet-route-handlers";
export const runtime="nodejs";
export const dynamic="force-dynamic";
export async function POST(request:NextRequest){return createWildsWalletRouteHandlers().transferNoWrite(request);}
