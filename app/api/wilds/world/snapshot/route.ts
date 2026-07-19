import { NextRequest, NextResponse } from "next/server";
import { worldSnapshot } from "@/lib/receiz/wilds-world-server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    return NextResponse.json({ ok: true, ...await worldSnapshot(request) }, { headers: { "cache-control": "private, no-store" } });
  } catch (error) {
    const message = error instanceof Error ? error.message : "wilds_world_snapshot_failed";
    const connectRequired = message === "wilds_world_connect_required"
      || message === "wilds_world_connect_identity_mismatch";
    return NextResponse.json({
      ok: false,
      error: message
    }, {
      status: connectRequired ? 401 : 503,
      headers: { "cache-control": "private, no-store" }
    });
  }
}
