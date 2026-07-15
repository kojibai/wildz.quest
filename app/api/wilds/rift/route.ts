import { NextRequest, NextResponse } from "next/server";
import { applyAuthorizedRiftPresence, getWildsMultiplayerSnapshot } from "@/features/play/multiplayer-ledger";
import { authorizeRiftTravel, type RiftTravelGrant } from "@/features/play/wilds-rift-travel";
import {
  hydrateWildsRoomFromReceiz,
  parseWildsRoomKey,
  resolveWildsMultiplayerActor
} from "@/lib/receiz/wilds-multiplayer-server";
import { wildsMultiplayerError } from "@/lib/receiz/wilds-multiplayer-response";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const riftLedgerKey = Symbol.for("receiz.wilds.rift-ledger.v1");

type RiftLedger = {
  grants: Map<string, RiftTravelGrant>;
};

function riftLedger() {
  const root = globalThis as typeof globalThis & { [riftLedgerKey]?: RiftLedger };
  return (root[riftLedgerKey] ??= { grants: new Map() });
}

function position(value: unknown) {
  if (!value || typeof value !== "object") return { x: Number.NaN, z: Number.NaN };
  const record = value as Record<string, unknown>;
  return { x: Number(record.x), z: Number(record.z) };
}

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null) as Record<string, unknown> | null;
  try {
    const roomKey = parseWildsRoomKey(body?.roomKey);
    const actor = await resolveWildsMultiplayerActor(request, body?.guestId);
    await hydrateWildsRoomFromReceiz(request, roomKey);
    const snapshot = getWildsMultiplayerSnapshot(roomKey);
    const currentPresence = snapshot.players.find((player) => player.playerId === actor.playerId);
    const submittedSource = position(body?.source);
    if (currentPresence && Math.hypot(currentPresence.x - submittedSource.x, currentPresence.z - submittedSource.z) > 3) {
      throw new Error("wilds_rift_source_mismatch");
    }
    const source = currentPresence
      ? { x: currentPresence.x, z: currentPresence.z }
      : submittedSource;
    const locked = snapshot.battles.some((battle) => battle.phase === "active" && Boolean(battle.players[actor.playerId]))
      || snapshot.challenges.some((challenge) => (
        ["accepted", "active"].includes(challenge.state)
        && [challenge.challengerId, challenge.opponentId].includes(actor.playerId)
      ));
    const idempotencyKey = typeof body?.idempotencyKey === "string" ? body.idempotencyKey : "";
    const cacheKey = `${actor.playerId}:${idempotencyKey}`;
    const ledger = riftLedger();
    const cached = ledger.grants.get(cacheKey);
    if (cached) {
      return NextResponse.json({ ok: true, grant: cached, idempotent: true }, {
        headers: { "cache-control": "private, no-store" }
      });
    }
    const result = authorizeRiftTravel({
      idempotencyKey,
      source,
      destination: position(body?.destination)
    }, {
      playerId: actor.playerId,
      coordinationPulse: `${snapshot.revision + 1}`,
      locked
    });
    if (!result.ok) throw new Error(result.error);
    applyAuthorizedRiftPresence({
      roomKey,
      playerId: actor.playerId,
      destination: result.grant.destination,
      kaiPulse: result.grant.kaiPulse
    });
    ledger.grants.set(cacheKey, result.grant);
    if (ledger.grants.size > 512) ledger.grants.delete(ledger.grants.keys().next().value!);
    return NextResponse.json({ ok: true, grant: result.grant, idempotent: false }, {
      headers: { "cache-control": "private, no-store" }
    });
  } catch (error) {
    return wildsMultiplayerError(error);
  }
}
