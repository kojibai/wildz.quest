import { NextRequest, NextResponse } from "next/server";
import { executeWildsWorldCommand } from "@/lib/receiz/wilds-world-server";
import { wildsWorldConnectUrl } from "@/lib/receiz/wilds-multiplayer-server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  try {
    return NextResponse.json({ ok: true, ...await executeWildsWorldCommand(request, await request.json()) });
  } catch (error) {
    const message = error instanceof Error ? error.message : "wilds_world_command_failed";
    const connectRequired = message === "wilds_world_connect_required"
      || message === "wilds_world_connect_identity_mismatch";
    return NextResponse.json({
      ok: false,
      error: message,
      ...(connectRequired ? { connectUrl: wildsWorldConnectUrl(request) } : {})
    }, {
      status: connectRequired ? 401 : message.includes("required") ? 403 : 400,
      headers: { "cache-control": "private, no-store" }
    });
  }
}
