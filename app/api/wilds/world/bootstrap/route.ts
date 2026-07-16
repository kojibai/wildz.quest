import { NextRequest, NextResponse } from "next/server";
import { bootstrapWildsWorld } from "@/lib/receiz/wilds-world-server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const NO_STORE_HEADERS = { "cache-control": "private, no-store" };
const SAFE_BOOTSTRAP_ERRORS = new Set([
  "wilds_world_canonical_publish_required",
  "wilds_world_canonical_recovery_required"
]);

export async function POST(request: NextRequest) {
  try {
    return NextResponse.json(
      { ok: true, ...await bootstrapWildsWorld(request) },
      { headers: NO_STORE_HEADERS }
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "wilds_world_bootstrap_unavailable";
    const proofRequired = message === "wilds_world_proof_session_required";
    return NextResponse.json({
      ok: false,
      error: proofRequired || SAFE_BOOTSTRAP_ERRORS.has(message)
        ? message
        : "wilds_world_bootstrap_unavailable"
    }, {
      status: proofRequired ? 401 : 503,
      headers: NO_STORE_HEADERS
    });
  }
}
