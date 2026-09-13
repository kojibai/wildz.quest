import { NextRequest, NextResponse } from "next/server";
import { receizBase64UrlDecode, receizBase64UrlEncode } from "@receiz/sdk";
import { createReceizCommerceAdapter } from "@/lib/receiz/adapter";
import { resolveWildsMultiplayerActor } from "@/lib/receiz/wilds-multiplayer-server";
import { createWildzExportProofObject, MAX_WILDZ_PROOF_OBJECT_BYTES } from "@/lib/receiz/wildz-proof-object-export";
import { openWildzArtifactEvidence } from "@/lib/receiz/wildz-artifact-custody";
import { prepareWildsRoamingHandoff, claimWildsRoamingHandoff, validateWildsRoamingHandoffCard } from "@/lib/receiz/wilds-roaming-handoff";
import { readWildsRoamingEncounter, recordWildsRoamingCaptureState } from "@/lib/receiz/wilds-roaming-battle-server";
import { readWildsRoamingClaimResult, storeWildsRoamingClaimResult, readWildsStoredRoamingHandoff, storeWildsRoamingHandoff } from "@/lib/receiz/wilds-roaming-capture-store";
import { publishWildzOwnershipSyncProjection } from "@/lib/receiz/wildz-ownership-reconcile";
import { sameWildzPlayerCoordinate } from "@/lib/receiz/wildz-player-coordinate";
import { observeWildsKaiUPulse } from "@/features/play/wilds-kai-runtime";
import { KAI_PULSE_DURATION_MS } from "@/features/play/kai-klok-moment";
import { verifyPortableCardPng, readWildzProofAppendsFromPng } from "@/features/play/card-export";
import type { PortableCardAsset } from "@/features/play/portable-card";

const CAPTURE_WINDOW_UPULSES = Math.ceil(120_000 / KAI_PULSE_DURATION_MS * 1_000_000);
const PRIVATE_HEADERS = { "cache-control": "private, no-store" };

const defaults = { resolveWildsMultiplayerActor, createReceizCommerceAdapter, createWildzExportProofObject, openWildzArtifactEvidence, prepareWildsRoamingHandoff, claimWildsRoamingHandoff, readWildsRoamingEncounter, recordWildsRoamingCaptureState, readWildsRoamingClaimResult, storeWildsRoamingClaimResult, readWildsStoredRoamingHandoff, storeWildsRoamingHandoff, publishWildzOwnershipSyncProjection, observeWildsKaiUPulse };
type Dependencies = typeof defaults;

export function createWildsRoamingCaptureHandler(overrides: Partial<Dependencies> = {}) {
  const d = { ...defaults, ...overrides };
  return async function POST(request: NextRequest) {
    try {
      const actor = await d.resolveWildsMultiplayerActor(request);
      if (actor.practice || !actor.accessToken) return NextResponse.json({ error: "wilds_capture_identity_required" }, { status: 401, headers: PRIVATE_HEADERS });
      const adapter = d.createReceizCommerceAdapter({ accessToken: actor.accessToken });
      const action = request.nextUrl.searchParams.get("action");
      if (action === "prepare") {
        const bytes = new Uint8Array(await request.arrayBuffer());
        if (!bytes.length || bytes.length > MAX_WILDZ_PROOF_OBJECT_BYTES) throw new Error("wilds_capture_source_size_invalid");
        const checked = verifyPortableCardPng(bytes);
        if (!checked.ok || !checked.asset) throw new Error("wilds_capture_source_card_invalid");
        const tail = readWildzProofAppendsFromPng(bytes).at(-1);
        validateWildsRoamingHandoffCard(bytes, tail && tail.kind !== "player-vault" ? tail.asset : checked.asset);
        const filename = decodeURIComponent(request.headers.get("x-wildz-artifact-filename") ?? "wildz-creature.png");
        const { admitted } = await d.createWildzExportProofObject({
          actor: { actorId: actor.playerId, profileHandle: actor.handle, receizUserId: actor.receizActorId },
          bytes, filename, kind: "card", createProofObject: adapter.client.assets.createProofObject, artifacts: adapter.client.artifacts
        });
        return new NextResponse(admitted.artifactBytes.slice().buffer, { headers: { ...PRIVATE_HEADERS,
          "content-type": admitted.mimeType, "content-disposition": `attachment; filename="${admitted.filename.replace(/["\\\r\n]/g, "-")}"`,
          "x-receiz-artifact-sha256": admitted.artifactSha256
        } });
      }
      const body = await request.json() as Record<string, unknown>;
      const id = typeof body.battleId === "string" ? body.battleId : "";
      const encounter = await d.readWildsRoamingEncounter(request, actor, id);
      const battle = encounter.session;
      if (!battle || !encounter.defenderAsset || battle.outcome !== "capture-eligible"
        || encounter.ownerAcknowledgedRevision !== battle.revision || encounter.cancelled) throw new Error("wilds_capture_approved_win_required");
      if (action !== "offer" && action !== "claim") throw new Error("wilds_capture_action_invalid");
      if (action === "offer" && !sameWildzPlayerCoordinate(actor.playerId, encounter.defenderId)) throw new Error("wilds_capture_owner_required");
      if (action === "claim") {
        if (!sameWildzPlayerCoordinate(actor.playerId, encounter.challenger.playerId)
          || actor.receizActorId !== encounter.challenger.receizId) throw new Error("wilds_capture_winner_required");
        const recovered = await d.readWildsRoamingClaimResult(request.nextUrl.origin, id);
        if (recovered) {
          if (recovered.winnerReceizId !== actor.receizActorId || recovered.card.id !== encounter.defenderAssetId) throw new Error("wilds_capture_result_invalid");
          const file = new File([receizBase64UrlDecode(recovered.artifact.exactBytesB64u).slice().buffer], recovered.artifact.filename, { type: recovered.artifact.mimeType });
          const admitted = (await d.openWildzArtifactEvidence(file, file.name, adapter.client.artifacts)).admitted;
          if (admitted.compatibility !== "current-native" || admitted.artifactSha256 !== recovered.artifact.artifactSha256 || !admitted.ownershipWitness
            || !sameWildzPlayerCoordinate(admitted.ownerReceizId, actor.handle)
            || !sameWildzPlayerCoordinate(admitted.ownershipWitness.ownerReceizId, actor.handle)
            || !sameWildzPlayerCoordinate(admitted.ownershipWitness.previousOwnerReceizId, encounter.defenderId)) throw new Error("wilds_capture_result_invalid");
          const base = validateWildsRoamingHandoffCard(admitted.payloadBytes, recovered.card);
          if (base.id !== encounter.defenderAssetId) throw new Error("wilds_capture_result_invalid");
          return NextResponse.json({ ok: true, card: recovered.card, artifact: recovered.artifact }, { headers: PRIVATE_HEADERS });
        }
        // A completed encounter is not permission to claim the old bearer again.
        // Recovery requires its retained, reverified native successor.
        if (encounter.capturePhase === "captured") throw new Error("wilds_capture_recovery_pending");
      }
      const expiresAtUPulse = battle.kaiUPulse + CAPTURE_WINDOW_UPULSES;
      if (!Number.isSafeInteger(expiresAtUPulse) || d.observeWildsKaiUPulse() >= expiresAtUPulse) {
        await d.recordWildsRoamingCaptureState(request, actor, id, "expired");
        throw new Error("wilds_capture_expired");
      }
      if (action === "offer") {
        if (!sameWildzPlayerCoordinate(actor.playerId, encounter.defenderId)) throw new Error("wilds_capture_owner_required");
        const wire = body.source as { exactBytesB64u?: unknown; filename?: unknown; mimeType?: unknown } | undefined;
        if (!wire || typeof wire.exactBytesB64u !== "string" || wire.exactBytesB64u.length > MAX_WILDZ_PROOF_OBJECT_BYTES * 1.4
          || typeof wire.filename !== "string" || typeof wire.mimeType !== "string") throw new Error("wilds_capture_source_invalid");
        const bytes = receizBase64UrlDecode(wire.exactBytesB64u);
        const file = new File([bytes.slice().buffer], wire.filename, { type: wire.mimeType });
        const source = (await d.openWildzArtifactEvidence(file, file.name, adapter.client.artifacts)).admitted;
        const handoff = await d.prepareWildsRoamingHandoff({ source, currentCard: body.currentCard as PortableCardAsset,
          ownerHandle: actor.handle, winnerHandle: encounter.challenger.handle, battle,
          challengerAsset: encounter.challengerAsset, defenderAsset: encounter.defenderAsset });
        await d.storeWildsRoamingHandoff(request.nextUrl.origin, actor.receizActorId, {
          schema: "wildz.roaming-capture-transport.v1", battleId: id, ownerPlayerId: encounter.defenderId,
          winnerPlayerId: encounter.challenger.playerId, winnerReceizId: encounter.challenger.receizId,
          expiresAtUPulse, handoff
        }, adapter);
        await d.recordWildsRoamingCaptureState(request, actor, id, "ready");
        // No original bearer bytes are ever returned by this route to an opponent.
        return NextResponse.json({ ok: true, ready: true }, { headers: PRIVATE_HEADERS });
      }
      if (action !== "claim") throw new Error("wilds_capture_action_invalid");
      if (!sameWildzPlayerCoordinate(actor.playerId, encounter.challenger.playerId)
        || actor.receizActorId !== encounter.challenger.receizId) throw new Error("wilds_capture_winner_required");
      const stored = await d.readWildsStoredRoamingHandoff(request.nextUrl.origin, id);
      if (!stored || stored.expiresAtUPulse !== expiresAtUPulse || stored.winnerReceizId !== actor.receizActorId
        || !sameWildzPlayerCoordinate(stored.winnerPlayerId, actor.playerId)
        || !sameWildzPlayerCoordinate(stored.ownerPlayerId, encounter.defenderId)
        || stored.handoff.assetId !== encounter.defenderAssetId) throw new Error("wilds_capture_offer_not_ready");
      const { admitted, currentCard } = await d.claimWildsRoamingHandoff({ handoff: stored.handoff,
        winnerHandle: actor.handle, port: adapter.client });
      const result = { schema: "wildz.roaming-claim-result.v1" as const, battleId: id, winnerReceizId: actor.receizActorId,
        card: currentCard, artifact: { exactBytesB64u: receizBase64UrlEncode(admitted.artifactBytes),
          artifactSha256: admitted.artifactSha256, filename: admitted.filename, mimeType: admitted.mimeType } };
      // The actual native result must still reach the receiver if secondary sync fails.
      await d.storeWildsRoamingClaimResult(request.nextUrl.origin, result, adapter).catch(() => undefined);
      await d.publishWildzOwnershipSyncProjection(adapter.client.appState, admitted.ownershipWitness!, [currentCard.id], `roaming:${id}`).catch(() => undefined);
      await d.recordWildsRoamingCaptureState(request, actor, id, "captured").catch(() => undefined);
      return NextResponse.json({ ok: true, card: result.card, artifact: result.artifact }, { headers: PRIVATE_HEADERS });
    } catch (cause) {
      const error = cause instanceof Error ? cause.message : "wilds_capture_failed";
      const status = /required|mismatch|invalid|ineligible/.test(error) ? 400 : /expired|not_ready|conflict/.test(error) ? 409 : 503;
      return NextResponse.json({ error }, { status, headers: PRIVATE_HEADERS });
    }
  };
}
