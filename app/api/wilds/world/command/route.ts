import { NextRequest, NextResponse } from "next/server";
import { executeWildsWorldCommand } from "@/lib/receiz/wilds-world-server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  try {
    return NextResponse.json({ ok: true, ...await executeWildsWorldCommand(request, await request.json()) });
  } catch (error) {
    const message = error instanceof Error ? error.message : "wilds_world_command_failed";
    return NextResponse.json({ ok: false, error: message }, { status: message.includes("required") ? 403 : 400 });
  }
}
