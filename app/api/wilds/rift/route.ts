import { parseWildsWorldAddress } from "@/features/play/wilds-world-address";
import { roomKeyForAddressV11 } from "@/features/play/multiplayer-core";
import { NextRequest, NextResponse } from "next/server";
import { applyAuthorizedRiftPresence, applyAuthorizedRiftPresenceV11, getWildsMultiplayerSnapshot } from "@/features/play/multiplayer-ledger";
import { authorizeRiftTravel, authorizeRiftTravelV11, isLocallyAdmittedRiftDestinationV11, type RiftTravelGrant, type RiftTravelGrantV11 } from "@/features/play/wilds-rift-travel";
import {
  hydrateWildsRoomFromReceiz,
  parseWildsRoomKey,
  publishWildsRoomToReceiz,
  resolveWildsMultiplayerActor
} from "@/lib/receiz/wilds-multiplayer-server";
import { wildsMultiplayerError } from "@/lib/receiz/wilds-multiplayer-response";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const riftLedgerKey = Symbol.for("receiz.wilds.rift-ledger.v1");

type RiftLedger = {
  grants: Map<string, RiftTravelGrant | RiftTravelGrantV11>;
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
    if (body?.version === 11) {
      const source = parseWildsWorldAddress(body.source);
      const destination = parseWildsWorldAddress(body.destination);
      // Cross-region arrival requires a verified travel admission, which is not
      // yet attached to this endpoint. Never turn client coordinates into access.
      if (!isLocallyAdmittedRiftDestinationV11(source, destination)) {
        throw new Error("wilds_rift_v11_destination_not_admitted");
      }
      const idempotencyKeyV11 = typeof body.idempotencyKey === "string" ? body.idempotencyKey : "";
      const cacheKeyV11 = `${actor.playerId}:v11:${idempotencyKeyV11}`;
      const ledgerV11 = riftLedger();
      const cachedV11 = ledgerV11.grants.get(cacheKeyV11);
      if (cachedV11) {
        if (!("version" in cachedV11) || cachedV11.version !== 11 || cachedV11.destination.regionX !== destination.regionX
          || cachedV11.destination.regionZ !== destination.regionZ || cachedV11.destination.localX !== destination.localX
          || cachedV11.destination.localZ !== destination.localZ) throw new Error("wilds_rift_idempotency_conflict");
        return NextResponse.json({ ok: true, grant: cachedV11, idempotent: true },
          { headers: { "cache-control": "private, no-store" } });
      }
      if (!currentPresence?.worldAddress || roomKey !== roomKeyForAddressV11("platform", source)
        || currentPresence.worldAddress.regionX !== source.regionX || currentPresence.worldAddress.regionZ !== source.regionZ
        || currentPresence.worldAddress.localX !== source.localX || currentPresence.worldAddress.localZ !== source.localZ) {
        throw new Error("wilds_rift_source_mismatch");
      }
      const lockedV11 = snapshot.battles.some((battle) => battle.phase === "active" && Boolean(battle.players[actor.playerId]))
        || snapshot.challenges.some((challenge) => ["accepted", "active"].includes(challenge.state)
          && [challenge.challengerId, challenge.opponentId].includes(actor.playerId));
      const resultV11 = authorizeRiftTravelV11({ idempotencyKey: idempotencyKeyV11, source, destination }, {
        playerId: actor.playerId, coordinationPulse: `${snapshot.revision + 1}`, locked: lockedV11
      });
      if (!resultV11.ok) throw new Error(resultV11.error);
      const transported = applyAuthorizedRiftPresenceV11({
        roomKey, playerId: actor.playerId, destination: resultV11.grant.destination, kaiPulse: resultV11.grant.kaiPulse
      });
      ledgerV11.grants.set(cacheKeyV11, resultV11.grant);
      if (ledgerV11.grants.size > 512) ledgerV11.grants.delete(ledgerV11.grants.keys().next().value!);
      const publications = transported.source.roomKey === transported.destination.roomKey
        ? [await publishWildsRoomToReceiz(request, actor, transported.destination)]
        : await Promise.all([
          publishWildsRoomToReceiz(request, actor, transported.source),
          publishWildsRoomToReceiz(request, actor, transported.destination)
        ]);
      return NextResponse.json({ ok: true, grant: resultV11.grant, idempotent: false, publications },
        { headers: { "cache-control": "private, no-store" } });
    }
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
    const room = applyAuthorizedRiftPresence({
      roomKey,
      playerId: actor.playerId,
      destination: result.grant.destination,
      kaiPulse: result.grant.kaiPulse
    });
    const publication = await publishWildsRoomToReceiz(request, actor, room);
    ledger.grants.set(cacheKey, result.grant);
    if (ledger.grants.size > 512) ledger.grants.delete(ledger.grants.keys().next().value!);
    return NextResponse.json({ ok: true, grant: result.grant, idempotent: false, publication }, {
      headers: { "cache-control": "private, no-store" }
    });
  } catch (error) {
    return wildsMultiplayerError(error);
  }
}
