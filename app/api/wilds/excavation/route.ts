import { NextRequest, NextResponse } from "next/server";
import { digestWildsExcavationCapabilityIdentity } from "@/features/play/wilds-excavation";
import {
  resolveWildsExcavationRouteAuthority,
  wildsExcavationStatusFor
} from "@/lib/receiz/wilds-excavation-route-authority";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";


function json(body: unknown, status = 200) {
  return NextResponse.json(body, { status, headers: { "cache-control": "no-store" } });
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => null) as Record<string, unknown> | null;
    if (!body || body.action !== "authority-preflight" || typeof body.actorSubjectId !== "string" || typeof body.creatureSubjectId !== "string") {
      throw new Error("wilds_excavation_request_invalid");
    }
    const authority = await resolveWildsExcavationRouteAuthority(request, {
      card: body.card,
      cardAdmission: body.cardAdmission,
      actorSubjectId: body.actorSubjectId,
      creatureSubjectId: body.creatureSubjectId
    });
    return json({
      ok: true,
      schema: "wildz.excavation.authority_preflight.v1",
      actorSubjectId: authority.actorSubject.subject.subjectId,
      actorHead: authority.actorSubject.subject.head,
      creatureSubjectId: authority.creatureSubject.subject.subjectId,
      creatureHead: authority.creatureSubject.subject.head,
      capabilityIdentityDigest: digestWildsExcavationCapabilityIdentity(authority.capability.identity),
      conditionDigest: authority.capability.conditionDigest
    });
  } catch (cause) {
    const code = cause instanceof Error ? cause.message : "wilds_excavation_request_invalid";
    return json({ ok: false, error: code, writes: 0 }, wildsExcavationStatusFor(code));
  }
}
