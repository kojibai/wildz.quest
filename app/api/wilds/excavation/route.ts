import { NextRequest, NextResponse } from "next/server";
import { digestWildsExcavationCapabilityIdentity } from "@/features/play/wilds-excavation";
import { resolveWildsExcavationRouteAuthority } from "@/lib/receiz/wilds-excavation-route-authority";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";


function json(body: unknown, status = 200) {
  return NextResponse.json(body, { status, headers: { "cache-control": "no-store" } });
}

export function wildsExcavationStatusFor(code: string) {
  if (code.includes("scope_required") || code.includes("identity_key_required") || code === "receiz_authority_required") return 401;
  if (code.includes("binding_invalid") || code.includes("subject_invalid") || code.includes("card_owner_invalid") || code.includes("profile_required")) return 403;
  if (code.includes("admission_required")) return 409;
  if (code === "receiz_subject_namespace_authority_required" || code === "receiz_subject_resolution_unavailable" || code === "receiz_profile_resolution_unavailable") return 503;
  if (code === "wilds_excavation_request_invalid") return 422;
  return 502;
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
