import { NextResponse } from "next/server";
import { admitWildzListing, discoverWildzListings } from "@/lib/receiz/wildz-market-adapter";
export async function GET() { return NextResponse.json({ listings: discoverWildzListings() }); }
export async function POST(request: Request) { try { const body = await request.json(); const idempotencyKey = request.headers.get("idempotency-key") ?? body.idempotencyKey; return NextResponse.json(admitWildzListing({ ...body, idempotencyKey }), { status: 201 }); } catch (cause) { return NextResponse.json({ error: cause instanceof Error ? cause.message : "market_invalid" }, { status: 400 }); } }
