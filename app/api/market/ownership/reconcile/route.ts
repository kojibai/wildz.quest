import { NextRequest, NextResponse } from "next/server";
import { createReceizCommerceAdapter } from "@/lib/receiz/adapter";
import { resolveWildzCookieActor } from "@/lib/receiz/wildz-cookie-actor";
import {
  lostWildzOwnershipAssetIdsFromSync,
  parseWildzOwnershipReconcileRequest,
  WILDZ_OWNERSHIP_SYNC_NAMESPACE
} from "@/lib/receiz/wildz-ownership-reconcile";
import { marketRouteError } from "@/lib/receiz/wildz-market-route";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function json(body: unknown, status = 200) {
  return NextResponse.json(body, { status, headers: { "cache-control": "no-store" } });
}

export async function POST(request: NextRequest) {
  try {
    const actor = await resolveWildzCookieActor(request);
    const assetIds = parseWildzOwnershipReconcileRequest(await request.json().catch(() => null));
    const adapter = createReceizCommerceAdapter({ accessToken: actor.accessToken });
    const projection = await adapter.client.appState.resolve({
      namespace: WILDZ_OWNERSHIP_SYNC_NAMESPACE
    });
    if (projection.ok !== true || !Array.isArray(projection.records)) {
      return json({ status: "ownership_sync_unavailable", lostAssetIds: [] }, 503);
    }
    return json({
      status: "ready",
      lostAssetIds: lostWildzOwnershipAssetIdsFromSync(projection.records, actor.actorId, assetIds)
    });
  } catch (cause) {
    const failure = marketRouteError(cause, "wildz_ownership_reconcile_unavailable");
    return json(failure.body, failure.status);
  }
}
