import { NextResponse } from "next/server";

export function wildsMultiplayerError(error: unknown) {
  const code = error instanceof Error ? error.message : "wilds_multiplayer_failed";
  const status = /identity|required|actor|owner/.test(code) ? 401
    : /not_found|unavailable/.test(code) ? 404
      : /busy|conflict|replayed|already|locked/.test(code) ? 409
        : /rate_limited/.test(code) ? 429
          : 422;
  return NextResponse.json({ ok: false, error: code }, { status });
}
