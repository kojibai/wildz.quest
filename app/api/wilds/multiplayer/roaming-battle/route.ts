import { NextRequest, NextResponse } from "next/server";
import { acknowledgeWildsRoamingEncounter, acceptWildsRoamingEncounter, cancelWildsRoamingEncounter, expireWildsRoamingEncounter, moveWildsRoamingEncounter, projectWildsRoamingEncounterNotice, requestWildsRoamingEncounter } from "@/features/play/wilds-roaming-encounter";
import { announceWildsRoamingEncounter, getWildsAtlasPresence } from "@/features/play/multiplayer-ledger";
import { WILDS_INTERACTION_DISTANCE } from "@/features/play/multiplayer-core";
import { assertCanonicalKaiTemporalRoot, type KaiTemporalRoot } from "@/features/play/kai-temporal-root";
import { deriveKaiKlokMoment, KAI_PULSE_DURATION_MS } from "@/features/play/kai-klok-moment";
import type { PortableCardAsset } from "@/features/play/portable-card";
import type { WildsRoamingBattleIntent } from "@/features/play/wilds-roaming-battle";
import { parseWildzPlayerCoordinate } from "@/lib/receiz/wildz-player-coordinate";
import { authorizeWildsMultiplayerCard, hydrateWildsRoomFromReceiz, parseWildsRoomKey, publishWildsRoomToReceiz, resolveWildsMultiplayerActor } from "@/lib/receiz/wilds-multiplayer-server";
import { assertWildsRoamingEncounterAvailable, publishWildsRoamingEncounter, readWildsRoamingEncounter, serializeWildsRoamingEncounter, storeWildsRoamingEncounter } from "@/lib/receiz/wilds-roaming-battle-server";
import { wildsMultiplayerError } from "@/lib/receiz/wilds-multiplayer-response";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
const id = (value: unknown) => typeof value === "string" && value.length <= 256 ? value : "";
const canonical = (value: string) => parseWildzPlayerCoordinate(value)?.actorId;
function admittedClock(value: unknown, at: string) {
  const kai = assertCanonicalKaiTemporalRoot(value as KaiTemporalRoot);
  const current = deriveKaiKlokMoment({ occurredAt: at, authority: "world" });
  if (Math.abs(kai.uPulse - current.uPulse) > 120_000 / KAI_PULSE_DURATION_MS * 1_000_000) throw new Error("wilds_roaming_encounter_clock_stale");
  return kai;
}
export async function GET(request: NextRequest) {
  try {
    const actor = await resolveWildsMultiplayerActor(request);
    const encounterId = id(request.nextUrl.searchParams.get("encounterId"));
    const row = await serializeWildsRoamingEncounter(async () => {
      const prior = await readWildsRoamingEncounter(request, actor, encounterId);
      const at = new Date().toISOString();
      const kai = deriveKaiKlokMoment({ occurredAt: at, authority: "world" });
      const next = expireWildsRoamingEncounter(prior, kai.uPulse, at);
      if (next !== prior) { storeWildsRoamingEncounter(next); await publishWildsRoamingEncounter(request, actor, next); }
      return next;
    });
    return NextResponse.json({ ok: true, encounter: row }, { headers: { "cache-control": "private, no-store" } });
  } catch (error) { return wildsMultiplayerError(error); }
}
export async function POST(request: NextRequest) {
  try {
    if (Number(request.headers.get("content-length") ?? 0) > 2_000_000) throw new Error("wilds_roaming_encounter_request_invalid");
    const body = await request.json() as Record<string, unknown>;
    const actor = await resolveWildsMultiplayerActor(request);
    if (actor.practice) throw new Error("wilds_roaming_encounter_identity_required");
    const at = new Date().toISOString();
    const kai = admittedClock(body.kai, at);
    const encounterId = id(body.encounterId);
    return await serializeWildsRoamingEncounter(async () => {
      let row;
      if (body.action === "request") {
        if (!actor.accessToken) throw new Error("wilds_roaming_encounter_native_identity_required");
        const roomKey = parseWildsRoomKey(body.roomKey);
        authorizeWildsMultiplayerCard(actor, body.card, body.cardAdmission);
        await hydrateWildsRoomFromReceiz(request, roomKey);
        const players = getWildsAtlasPresence({ actorId: "", center: { x: 0, z: 0 } }).players;
        const challenger = players.find(player => canonical(player.playerId) === canonical(actor.playerId));
        const defender = players.find(player => canonical(player.playerId) === canonical(id(body.defenderId)));
        const roamer = defender?.roamingCreatures?.find(creature => creature.assetId === body.defenderAssetId && creature.proofDigest === body.defenderProofDigest);
        if (!challenger || !defender || !roamer || defender.practice || roamer.returning || !["roaming", "observing"].includes(roamer.phase)
          || Math.hypot(challenger.x - roamer.x, challenger.z - roamer.z) > WILDS_INTERACTION_DISTANCE) throw new Error("wilds_roaming_encounter_nearby_creature_required");
        let existing;
        try { existing = await readWildsRoamingEncounter(request, actor, encounterId); }
        catch (error) { if (!(error instanceof Error) || error.message !== "wilds_roaming_encounter_not_found") throw error; }
        if (existing) {
          if (existing.challenger.playerId !== canonical(actor.playerId) || existing.defenderId !== canonical(defender.playerId)
            || existing.defenderAssetId !== roamer.assetId || existing.defenderProofDigest !== roamer.proofDigest
            || existing.challengerAsset.proof.digest !== (body.card as PortableCardAsset).proof.digest) throw new Error("wilds_roaming_encounter_request_conflict");
          row = existing;
        } else row = requestWildsRoamingEncounter({ id: encounterId, roomKey,
          challenger: { playerId: actor.playerId, handle: actor.handle, receizId: actor.receizActorId },
          challengerAsset: body.card as PortableCardAsset, defenderId: defender.playerId,
          defenderAssetId: roamer.assetId, defenderProofDigest: roamer.proofDigest, kaiUPulse: kai.uPulse });
        storeWildsRoamingEncounter(row);
        await publishWildsRoomToReceiz(request, actor, announceWildsRoamingEncounter(projectWildsRoamingEncounterNotice(row), at));
      } else {
        const prior = await readWildsRoamingEncounter(request, actor, encounterId);
        row = expireWildsRoamingEncounter(prior, kai.uPulse, at);
        if (body.action === "accept") {
          assertWildsRoamingEncounterAvailable(row, kai.uPulse);
          authorizeWildsMultiplayerCard(actor, body.card, body.cardAdmission);
          row = acceptWildsRoamingEncounter(row, { actorId: actor.playerId, defenderAsset: body.card as PortableCardAsset,
            expeditionId: id(body.expeditionId), kaiUPulse: kai.uPulse, at });
        } else if (body.action === "intent") {
          authorizeWildsMultiplayerCard(actor, body.card, body.cardAdmission);
          if ((body.card as PortableCardAsset).proof.digest !== row.challengerAsset.proof.digest) throw new Error("wilds_roaming_encounter_proof_changed");
          row = moveWildsRoamingEncounter(row, { actorId: actor.playerId, expectedRevision: Number(body.expectedRevision), expectedTurn: Number(body.expectedTurn), intentId: id(body.intentId), intent: body.intent as WildsRoamingBattleIntent, kaiUPulse: kai.uPulse, at });
        } else if (body.action === "acknowledge") row = acknowledgeWildsRoamingEncounter(row, { actorId: actor.playerId, expectedRevision: Number(body.expectedRevision), expeditionId: id(body.expeditionId) });
        else if (body.action === "cancel") row = cancelWildsRoamingEncounter(row, actor.playerId);
        else throw new Error("wilds_roaming_encounter_action_invalid");
        storeWildsRoamingEncounter(row);
      }
      const publication = await publishWildsRoamingEncounter(request, actor, row);
      return NextResponse.json({ ok: true, encounter: row, publication }, { headers: { "cache-control": "private, no-store" } });
    });
  } catch (error) { return wildsMultiplayerError(error); }
}
