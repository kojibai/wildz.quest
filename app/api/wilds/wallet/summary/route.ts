import { NextRequest } from "next/server";
import { createWildsWalletRouteHandlers } from "@/lib/receiz/wilds-wallet-route-handlers";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const handlers = createWildsWalletRouteHandlers();

export async function GET(request: NextRequest) {
  return handlers.summary(request);
}
