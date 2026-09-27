import { createPrivateKey, createPublicKey } from "node:crypto";
import { createReceizRemoteAdmissionStore } from "@receiz/sdk";
import { NextRequest, NextResponse } from "next/server";
import { parseWildsWorldAddress } from "@/features/play/wilds-world-address";
import { WILDS_V11_ENCOUNTER_KEY_ID, WILDS_V11_ENCOUNTER_PUBLIC_KEYS } from "@/features/play/wilds-v11-release-keys";
import { admitWildsV11Travel, issueWildsV11Encounter } from "@/lib/receiz/wilds-v11-encounter-authority";
import { resolveWildsMultiplayerActor } from "@/lib/receiz/wilds-multiplayer-server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function signingKeyPem() {
  const encoded = process.env.WILDZ_V11_ENCOUNTER_SIGNING_KEY_PKCS8_B64;
  if (!encoded || !/^[A-Za-z0-9+/]+={0,2}$/.test(encoded)) throw new Error("wilds_v11_authority_unavailable");
  const key = createPrivateKey({ key: Buffer.from(encoded, "base64"), format: "der", type: "pkcs8" });
  if (key.asymmetricKeyType !== "ed25519"
    || createPublicKey(key).export({ format: "jwk" }).x !== WILDS_V11_ENCOUNTER_PUBLIC_KEYS[WILDS_V11_ENCOUNTER_KEY_ID]) {
    throw new Error("wilds_v11_authority_unavailable");
  }
  return key.export({ format: "pem", type: "pkcs8" }).toString();
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json() as Record<string, unknown>;
    if (!body || typeof body !== "object" || Array.isArray(body)) throw new Error("wilds_v11_request_invalid");
    const actor = await resolveWildsMultiplayerActor(request, undefined, { resolveConnectProfile: false });
    if (actor.practice) throw new Error("wilds_v11_verified_identity_required");
    const serviceToken = process.env.RECEIZ_CONNECT_ACCESS_TOKEN;
    if (!serviceToken) throw new Error("wilds_v11_authority_unavailable");
    const store = createReceizRemoteAdmissionStore({ namespace: "wildz-v11-encounters", accessToken: serviceToken,
      baseUrl: process.env.RECEIZ_BASE_URL ?? "https://receiz.com" });
    if (body.action === "travel") {
      const address = parseWildsWorldAddress(body.address);
      const head = await admitWildsV11Travel(store, actor.playerId, address);
      return NextResponse.json({ ok: true, head }, { headers: { "cache-control": "no-store" } });
    }
    if (body.action === "encounter") {
      const site = parseWildsWorldAddress(body.site);
      const result = await issueWildsV11Encounter({ store, actorId: actor.playerId, site, slot: Number(body.slot),
        keyId: WILDS_V11_ENCOUNTER_KEY_ID, privateKeyPem: signingKeyPem(), pinnedKeys: WILDS_V11_ENCOUNTER_PUBLIC_KEYS });
      return NextResponse.json({ ok: true, result }, { headers: { "cache-control": "no-store" } });
    }
    throw new Error("wilds_v11_action_invalid");
  } catch (cause) {
    const code = cause instanceof Error && cause.message.startsWith("wilds_v11_") ? cause.message : "wilds_v11_request_failed";
    return NextResponse.json({ ok: false, error: code }, { status: code === "wilds_v11_authority_unavailable" ? 503 : 400,
      headers: { "cache-control": "no-store" } });
  }
}
