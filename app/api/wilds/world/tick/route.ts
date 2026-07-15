import { timingSafeEqual } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { tickWildsWorld } from "@/lib/receiz/wilds-world-server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function authorized(request: NextRequest) {
  const secret = process.env.WILDS_PULSE_TICK_SECRET;
  const supplied = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "") ?? "";
  if (!secret) throw new Error("wilds_pulse_authority_unconfigured");
  const left = Buffer.from(secret);
  const right = Buffer.from(supplied);
  return left.length === right.length && timingSafeEqual(left, right);
}

export async function POST(request: NextRequest) {
  try {
    if (!authorized(request)) return NextResponse.json({ ok: false, error: "wilds_pulse_authority_invalid" }, { status: 401 });
    return NextResponse.json({ ok: true, ...await tickWildsWorld(request) });
  } catch (error) {
    const message = error instanceof Error ? error.message : "wilds_world_tick_failed";
    return NextResponse.json({ ok: false, error: message }, { status: 503 });
  }
}
