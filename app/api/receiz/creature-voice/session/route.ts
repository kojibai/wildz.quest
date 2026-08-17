import { NextRequest, NextResponse } from "next/server";
import { projectCreatureBrain } from "@/features/play/creature-consciousness";
import type { PortableCardAsset } from "@/features/play/portable-card";
import { resolveWildzGameplayCookieActor } from "@/lib/receiz/wildz-cookie-actor";
import { canCurrentWildzOwnerObserveCreature } from "@/lib/receiz/wildz-creature-observer-ownership";
import { readWildzProofSessionCookie } from "@/lib/receiz/wildz-proof-session";
import { wildzStreamingVoiceProfile } from "@/lib/receiz/wildz-voice-lock";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 10;

const DEFAULT_BASE_VOICE_ID = "JBFqnCBsd6RMkjVDRZzb";
const TOKEN_TIMEOUT_MS = 4_000;

function apiKey() {
  const value = process.env.RECEIZ_CREATURE_VOICE_API_KEY?.trim()
    || process.env.ELEVENLABS_API_KEY?.trim();
  if (!value) throw new Error("creature_observer_voice_configuration_missing");
  return value;
}

function baseVoiceIds() {
  const configured = process.env.RECEIZ_CREATURE_VOICE_BASE_VOICE_IDS
    ?.split(",")
    .map((value) => value.trim())
    .filter((value) => /^[A-Za-z0-9_-]{8,64}$/.test(value));
  return configured?.length ? configured : [DEFAULT_BASE_VOICE_ID];
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => null) as Record<string, unknown> | null;
    if (!body?.card) throw new Error("creature_voice_session_request_invalid");
    const card = body.card as PortableCardAsset;
    const brain = projectCreatureBrain(card);
    const actor = await resolveWildzGameplayCookieActor(request);
    let proofSession: ReturnType<typeof readWildzProofSessionCookie> | null = null;
    try { proofSession = readWildzProofSessionCookie(request); } catch { /* Ownership fails closed. */ }
    if (!canCurrentWildzOwnerObserveCreature({
      actorId: actor.actorId,
      profileHandle: actor.profileHandle,
      proofSession,
      card,
      cardAdmission: body.cardAdmission
    })) throw new Error("creature_observer_owner_mismatch");

    const signature = brain.performance.expression.voiceSignature;
    const profile = wildzStreamingVoiceProfile(signature);
    const voices = baseVoiceIds();
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), TOKEN_TIMEOUT_MS);
    const tokenResponse = await fetch("https://api.elevenlabs.io/v1/single-use-token/tts_websocket", {
      method: "POST",
      headers: { "xi-api-key": apiKey() },
      cache: "no-store",
      signal: controller.signal
    }).finally(() => clearTimeout(timeout));
    const tokenBody = await tokenResponse.json().catch(() => null) as { token?: unknown } | null;
    if (!tokenResponse.ok || typeof tokenBody?.token !== "string" || !tokenBody.token) {
      throw new Error("creature_observer_voice_unavailable");
    }

    return NextResponse.json({
      ok: true,
      token: tokenBody.token,
      voiceId: voices[profile.seed % voices.length],
      signature,
      model: "eleven_flash_v2_5",
      outputFormat: "pcm_24000",
      sampleRate: 24_000,
      seed: profile.seed,
      settings: {
        stability: profile.stability,
        similarityBoost: profile.similarityBoost,
        style: profile.style,
        speed: profile.speed
      },
      articulation: {
        brightnessHz: profile.brightnessHz,
        mouthResponse: profile.mouthResponse
      }
    }, { headers: { "cache-control": "no-store" } });
  } catch (cause) {
    const error = cause instanceof Error ? cause.message : "creature_observer_voice_unavailable";
    const status = error === "creature_observer_owner_mismatch" ? 403
      : error === "creature_voice_session_request_invalid" ? 422
        : 503;
    return NextResponse.json({ ok: false, error }, { status, headers: { "cache-control": "no-store" } });
  }
}
