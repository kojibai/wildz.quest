import { NextResponse } from "next/server";

// The stable URL is the projection coordinate. Message content is never served
// from this public route; Receiz resolves its private projection for participants.
export async function GET() {
  return NextResponse.json({ ok: true, kind: "wilds-private-conversation-coordinate" }, {
    headers: { "cache-control": "public, max-age=300" }
  });
}
