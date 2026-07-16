import { NextRequest, NextResponse } from "next/server";
import { executeHearttreeAdmission } from "@/lib/receiz/wilds-hearttree-server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  try {
    return NextResponse.json({ ok: true, ...await executeHearttreeAdmission(request, await request.json()) }, { headers: { "cache-control": "private, no-store" } });
  } catch (error) {
    const message = error instanceof Error ? error.message : "wilds_hearttree_admission_failed";
    const status = message.includes("owner") || message.includes("authority") ? 403 : 400;
    return NextResponse.json({ ok: false, error: message }, { status, headers: { "cache-control": "private, no-store" } });
  }
}
