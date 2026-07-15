import { NextResponse } from "next/server";
import { admitWildzTrade } from "@/lib/receiz/wildz-market-adapter";
export async function POST(request: Request) { try { const body = await request.json(); const idempotencyKey = request.headers.get("idempotency-key") ?? body.idempotencyKey; return NextResponse.json(admitWildzTrade({ ...body, idempotencyKey }), { status: 201 }); } catch (cause) { return NextResponse.json({ error: cause instanceof Error ? cause.message : "trade_invalid", ownershipTransferred: false }, { status: 409 }); } }
