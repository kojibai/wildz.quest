import { randomBytes } from "node:crypto";
import { NextResponse } from "next/server";
import {
  WILDZ_PROOF_NONCE_COOKIE,
  wildzProofNonceCookieOptions
} from "@/lib/receiz/wildz-proof-session";

export const runtime = "nodejs";

export async function POST() {
  const nonceB64Url = randomBytes(24).toString("base64url");
  const response = NextResponse.json(
    { ok: true, nonceB64Url },
    { headers: { "cache-control": "no-store" } }
  );
  response.cookies.set(WILDZ_PROOF_NONCE_COOKIE, nonceB64Url, wildzProofNonceCookieOptions());
  return response;
}
