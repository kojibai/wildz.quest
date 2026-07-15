import { NextRequest, NextResponse } from "next/server";
import { worldSnapshot } from "@/lib/receiz/wilds-world-server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    return NextResponse.json({ ok: true, projection: await worldSnapshot(request) }, { headers: { "cache-control": "public, max-age=1, stale-while-revalidate=4" } });
  } catch (error) {
    return NextResponse.json({ ok: false, error: error instanceof Error ? error.message : "wilds_world_snapshot_failed" }, { status: 503 });
  }
}
