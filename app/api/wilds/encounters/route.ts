import { createReceizRemoteAdmissionStore } from "@receiz/sdk";
import { createPrivateKey } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { WILDS_V11_ENCOUNTER_KEY_ID, WILDS_V11_ENCOUNTER_PUBLIC_KEYS } from "@/features/play/wilds-v11-release-keys";
import { parseWildsWorldAddress } from "@/features/play/wilds-world-address";
import { issueWildsV11Encounter } from "@/lib/receiz/wilds-v11-encounter-authority";
import { resolveWildsMultiplayerActor } from "@/lib/receiz/wilds-multiplayer-server";
import { loadWildzPlayerState } from "@/lib/receiz/wildz-player-state-sync";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json() as Record<string, unknown>;
    if (!body || typeof body !== "object" || Array.isArray(body)) throw new Error("wilds_v11_request_invalid");
    const actor = await resolveWildsMultiplayerActor(request);
    if (actor.practice) throw new Error("wilds_v11_verified_identity_required");
    if (!actor.accessToken) throw new Error("wilds_v11_authority_unavailable");
    if (body.action !== "encounter") throw new Error("wilds_v11_action_invalid");
    const source = await loadWildzPlayerState(request, actor);
    if (!source || source.playerId !== actor.playerId || source.player.playState.worldCoordinateMode !== "region-local") {
      throw new Error("wilds_v11_player_source_required");
    }
    const signingKey = process.env.WILDZ_V11_ENCOUNTER_SIGNING_KEY_PKCS8_B64;
    if (!signingKey) throw new Error("wilds_v11_authority_unavailable");
    const privateKeyPem = createPrivateKey({ key: Buffer.from(signingKey, "base64"),
      format: "der", type: "pkcs8" }).export({ format: "pem", type: "pkcs8" }).toString();
    const store = createReceizRemoteAdmissionStore({ namespace: "wildz-v11-encounters", accessToken: actor.accessToken,
      baseUrl: process.env.RECEIZ_BASE_URL ?? "https://receiz.com" });
    const playerAddress = parseWildsWorldAddress(source.player.playState.worldAddress);
    const site = parseWildsWorldAddress(body.site);
    const result = await issueWildsV11Encounter({ store, actorId: actor.playerId, playerAddress, site,
      slot: Number(body.slot), keyId: WILDS_V11_ENCOUNTER_KEY_ID, privateKeyPem,
      pinnedKeys: WILDS_V11_ENCOUNTER_PUBLIC_KEYS });
    return NextResponse.json({ ok: true, result }, { headers: { "cache-control": "private, no-store" } });
  } catch (cause) {
    const code = cause instanceof Error && cause.message.startsWith("wilds_v11_") ? cause.message : "wilds_v11_request_failed";
    return NextResponse.json({ ok: false, error: code }, { status: code === "wilds_v11_authority_unavailable"
      || code === "wilds_v11_player_source_required" ? 503 : 400,
      headers: { "cache-control": "no-store" } });
  }
}
