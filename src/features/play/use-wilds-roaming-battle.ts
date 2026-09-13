"use client";

import { WILDZ_OWNERSHIP_REFRESH_EVENT } from "../identity/wildz-live-ownership";
import { createWildsRoamingReportStore } from "./wilds-roaming-report-store";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { WildzVaultCardMembershipProof } from "../../lib/receiz/wildz-vault-card-admission";
import { sameWildzPlayerCoordinate } from "../../lib/receiz/wildz-player-coordinate";
import type { PortableCardAsset } from "./portable-card";
import { canonicalPortableCardJson } from "./portable-card";
import type { KaiTemporalRoot } from "./kai-temporal-root";
import { replayWildsRoamingBattle, projectWildsRoamingBattleReport, type WildsRoamingBattleIntent } from "./wilds-roaming-battle";
import { shouldPollWildsRoamingEncounter, wildsRoamingEncounterHoldExpiry, type WildsRoamingEncounter, type WildsRoamingEncounterNotice } from "./wilds-roaming-encounter";

export type WildsRoamingBattleCard = { card: PortableCardAsset; cardAdmission?: WildzVaultCardMembershipProof | null };
export type WildsOwnedRoamer = WildsRoamingBattleCard & { expeditionId: string };
export type WildsRoamingBattleControllerInput = {
  enabled: boolean; selfId: string; reportOwner?: string; notices: readonly WildsRoamingEncounterNotice[];
  getKai: () => KaiTemporalRoot;
  readChallengerCard: () => WildsRoamingBattleCard | null;
  /** Must check current verified custody and the exact active, non-recalled expedition. */
  readOwnedRoamer: (assetId: string, proofDigest: string) => WildsOwnedRoamer | null;
  /** While held, owner controls queue return/recall instead of moving this expedition. */
  onBattleLock: (assetId: string, locked: boolean) => void;
  /** Owner side only, after local accepted-genesis replay and authenticated acknowledgement. */
  onWinningBattle: (encounter: WildsRoamingEncounter) => void | Promise<void>;
  /** Challenger side: root completes the existing native original-artifact claim. */
  onClaim: (encounter: WildsRoamingEncounter) => void | Promise<void>;
  isCaptureRestored?: (encounter: WildsRoamingEncounter) => boolean;
};
type Accepted = { expeditionId: string; genesis: string; defenderAsset: PortableCardAsset };
const genesis = (row: WildsRoamingEncounter) => canonicalPortableCardJson([row.id, row.challenger, row.challengerAsset, row.defenderId, row.defenderAssetId, row.defenderProofDigest, row.requestedKaiUPulse, row.expiresKaiUPulse]);
const endpoint = "/api/wilds/multiplayer/roaming-battle";
async function request(body?: Record<string, unknown>, encounterId?: string) {
  const abort = new AbortController();
  const timer = setTimeout(() => abort.abort(), 8000);
  try {
    const response = await fetch(body ? endpoint : `${endpoint}?encounterId=${encodeURIComponent(encounterId ?? "")}`, body ? {
      method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body), cache: "no-store", signal: abort.signal
    } : { cache: "no-store", signal: abort.signal });
    const result = await response.json() as { encounter?: WildsRoamingEncounter; error?: string };
    if (!response.ok || !result.encounter) throw new Error(result.error ?? "The roaming encounter could not be refreshed.");
    return result.encounter;
  } finally { clearTimeout(timer); }
}

export function useWildsRoamingBattle(input: WildsRoamingBattleControllerInput) {
  const latest = useRef(input); latest.current = input;
  const reportStore = useMemo(() => createWildsRoamingReportStore(), []);
  const captureObserved = useRef(new Set<string>());
  const reporting = useRef(new Set<string>());
  const reported = useRef(new Set<string>());
  const [encounters, setEncounters] = useState<Record<string, WildsRoamingEncounter>>({});
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const sending = useRef(false);
  const accepted = useRef(new Map<string, Accepted>());
  const released = useRef(new Set<string>());
  const locks = useRef(new Map<string, string>());
  const lockExpiries = useRef(new Map<string, number>());
  const offered = useRef(new Set<string>());
  const knownIds = useRef(new Set<string>());
  const settledIds = useRef(new Set<string>());
  const generation = useRef(0);
  const selection = useRef<string | null>(null);
  const persistIds = useCallback(() => {
    if (!latest.current.selfId) return;
    try { window.localStorage.setItem(`wildz:roaming-encounters:v1:${latest.current.selfId}`, JSON.stringify({ ids: [...knownIds.current].slice(-24), selectedId: selection.current })); } catch { /* server notices still recover live requests */ }
  }, []);
  const remember = useCallback((row: WildsRoamingEncounter) => {
    const firstObservation = !knownIds.current.has(row.id);
    knownIds.current.add(row.id);
    if (knownIds.current.size > 64) knownIds.current.delete(knownIds.current.values().next().value!);
    if (firstObservation) persistIds();
    setEncounters(prior => {
      if (prior[row.id] && prior[row.id].revision >= row.revision) return prior;
      const next = { ...prior, [row.id]: row };
      const ids = Object.keys(next);
      if (ids.length > 32) delete next[ids[0]!];
      return next;
    });
  }, [persistIds]);
  const unlock = useCallback((row: WildsRoamingEncounter) => {
    if (!released.current.has(row.id) && (locks.current.get(row.defenderAssetId) === row.id || (!locks.current.has(row.defenderAssetId) && accepted.current.has(row.id)))) {
      released.current.add(row.id);
      locks.current.delete(row.defenderAssetId);
      lockExpiries.current.delete(row.defenderAssetId);
      latest.current.onBattleLock(row.defenderAssetId, false);
    }
  }, []);

  useEffect(() => {
    generation.current++;
    locks.current.clear(); released.current.clear(); lockExpiries.current.clear(); accepted.current.clear(); offered.current.clear(); reported.current.clear(); reporting.current.clear(); captureObserved.current.clear(); settledIds.current.clear(); knownIds.current.clear();
    setEncounters({}); setSelectedId(null); selection.current = null; setError("");
    if (input.selfId) try {
      const stored = JSON.parse(window.localStorage.getItem(`wildz:roaming-encounters:v1:${input.selfId}`) ?? "null") as { ids?: unknown; selectedId?: unknown } | null;
      if (Array.isArray(stored?.ids)) for (const id of stored.ids.slice(-24)) if (typeof id === "string" && /^[a-zA-Z0-9:-]{8,160}$/.test(id)) knownIds.current.add(id);
      if (typeof stored?.selectedId === "string" && knownIds.current.has(stored.selectedId)) { selection.current = stored.selectedId; setSelectedId(stored.selectedId); }
    } catch { /* corrupt discovery cache never supplies battle authority */ }
  }, [input.selfId]);

  useEffect(() => {
    const timer = setInterval(() => {
      const current = latest.current;
      const nowKai = current.getKai().uPulse;
      for (const [assetId, expiry] of lockExpiries.current) {
        if (nowKai >= expiry) {
          const id = locks.current.get(assetId); if (id) released.current.add(id);
          locks.current.delete(assetId); lockExpiries.current.delete(assetId); current.onBattleLock(assetId, false);
        }
      }
    }, 500);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    if (!input.enabled || !input.selfId) return;
    let disposed = false;
    let timer: ReturnType<typeof setTimeout>;
    const mine = generation.current;
    const poll = async () => {
      try {
        const current = latest.current;
        const nowKai = current.getKai().uPulse;
        for (const [assetId, expiry] of lockExpiries.current) {
          if (nowKai >= expiry) { locks.current.delete(assetId); lockExpiries.current.delete(assetId); current.onBattleLock(assetId, false); }
        }
        const ids = [...new Set([...knownIds.current, ...current.notices.filter(notice => notice.expiresKaiUPulse > nowKai && (
          sameWildzPlayerCoordinate(notice.defenderId, current.selfId) || sameWildzPlayerCoordinate(notice.challengerId, current.selfId))
        ).map(notice => notice.id)])].filter(id => !settledIds.current.has(id)).slice(-24);
        for (const id of ids) {
          if (disposed || mine !== generation.current) break;
          try {
          let row = await request(undefined, id);
          if (disposed || mine !== generation.current) break;
          if (!sameWildzPlayerCoordinate(row.defenderId, current.selfId) && !sameWildzPlayerCoordinate(row.challenger.playerId, current.selfId)) continue;
          remember(row);
          if (row.session && row.session.outcome !== "active" && !reported.current.has(row.id) && !reporting.current.has(row.id)) {
            reporting.current.add(row.id);
            void reportStore.append(current.reportOwner ?? current.selfId, row).then(() => { if (mine === generation.current) reported.current.add(row.id); })
              .catch(() => undefined).finally(() => reporting.current.delete(row.id));
          }
          if (row.capturePhase === "captured" && !captureObserved.current.has(row.id)) {
            captureObserved.current.add(row.id); window.dispatchEvent(new Event(WILDZ_OWNERSHIP_REFRESH_EVENT));
          }
          if (locks.current.get(row.defenderAssetId) === row.id) lockExpiries.current.set(row.defenderAssetId, wildsRoamingEncounterHoldExpiry(row));
          if (sameWildzPlayerCoordinate(row.defenderId, current.selfId)) {
            if (!row.session && !row.cancelled) {
              const owned = current.readOwnedRoamer(row.defenderAssetId, row.defenderProofDigest);
              if (!owned || (locks.current.has(row.defenderAssetId) && locks.current.get(row.defenderAssetId) !== row.id)) continue;
              accepted.current.set(row.id, { expeditionId: owned.expeditionId, genesis: genesis(row), defenderAsset: owned.card });
              if (!locks.current.has(row.defenderAssetId)) { locks.current.set(row.defenderAssetId, row.id); lockExpiries.current.set(row.defenderAssetId, wildsRoamingEncounterHoldExpiry(row)); current.onBattleLock(row.defenderAssetId, true); }
              row = await request({ action: "accept", encounterId: row.id, ...owned, kai: current.getKai() });
              if (disposed || mine !== generation.current) break;
            }
            if (row.session && !accepted.current.has(row.id)) {
              // A signed server admission may resume only the same still-active owned expedition.
              const owned = current.readOwnedRoamer(row.defenderAssetId, row.defenderProofDigest);
              if (owned && owned.expeditionId === row.expeditionId) {
                accepted.current.set(row.id, { expeditionId: owned.expeditionId, genesis: genesis(row), defenderAsset: owned.card });
                if (!locks.current.has(row.defenderAssetId) && row.capturePhase !== "captured" && row.capturePhase !== "expired" && current.getKai().uPulse < wildsRoamingEncounterHoldExpiry(row)) {
                  locks.current.set(row.defenderAssetId, row.id); lockExpiries.current.set(row.defenderAssetId, wildsRoamingEncounterHoldExpiry(row)); current.onBattleLock(row.defenderAssetId, true);
                }
              }
            }
            const local = accepted.current.get(row.id);
            if (row.session && local && local.genesis === genesis(row) && local.expeditionId === row.expeditionId) {
              replayWildsRoamingBattle(row.session, { challengerAsset: row.challengerAsset, defenderAsset: local.defenderAsset });
              if (row.session.outcome !== "active" && row.ownerAcknowledgedRevision !== row.session.revision) {
                row = await request({ action: "acknowledge", encounterId: row.id, expectedRevision: row.session.revision, expeditionId: local.expeditionId, kai: current.getKai() });
              }
              if (disposed || mine !== generation.current) break;
              if (row.session && row.session.outcome !== "active" && row.session.outcome !== "capture-eligible") unlock(row);
              if (row.session?.outcome === "capture-eligible" && row.ownerAcknowledgedRevision === row.session.revision && !row.capturePhase && current.getKai().uPulse < wildsRoamingEncounterHoldExpiry(row) && !offered.current.has(row.id)) {
                await current.onWinningBattle(row);
                offered.current.add(row.id);
              }
            }
            if (current.getKai().uPulse >= wildsRoamingEncounterHoldExpiry(row)) unlock(row);
            if (row.cancelled || row.capturePhase === "captured" || row.capturePhase === "expired" || (row.session && row.session.outcome !== "active" && row.session.outcome !== "capture-eligible")) unlock(row);
          }
          if (!disposed && mine === generation.current) {
            remember(row);
            if (!shouldPollWildsRoamingEncounter(row, current.selfId, reported.current.has(row.id), Boolean(current.isCaptureRestored?.(row)))) {
              settledIds.current.add(row.id);
              if (settledIds.current.size > 128) settledIds.current.delete(settledIds.current.values().next().value!);
              knownIds.current.delete(row.id); persistIds();
            }
          }
          } catch (cause) {
            if (!disposed) setError(cause instanceof Error ? cause.message : "The roaming encounter could not be refreshed.");
          }
        }
      } catch (cause) { if (!disposed) setError(cause instanceof Error ? cause.message : "The roaming encounter could not be refreshed."); }
      if (!disposed) timer = setTimeout(() => void poll(), 1500);
    };
    void poll();
    return () => { disposed = true; clearTimeout(timer); };
  }, [input.enabled, input.selfId, remember, unlock, reportStore, persistIds]);



  const run = useCallback(async (work: () => Promise<void>) => {
    if (sending.current) return;
    sending.current = true; setPending(true); setError("");
    try { await work(); }
    catch (cause) { setError(cause instanceof Error ? cause.message : "The roaming encounter could not be updated."); }
    finally { sending.current = false; setPending(false); }
  }, []);
  const challenge = useCallback((target: { roomKey: string; ownerId: string; assetId: string; proofDigest: string }) => run(async () => {
    const card = latest.current.readChallengerCard();
    if (!card) throw new Error("Choose your verified creature before challenging a roamer.");
    const id = `roaming:${crypto.randomUUID()}`;
    const row = await request({ action: "request", encounterId: id, roomKey: target.roomKey,
      defenderId: target.ownerId, defenderAssetId: target.assetId, defenderProofDigest: target.proofDigest,
      ...card, kai: latest.current.getKai() });
    selection.current = id; remember(row); setSelectedId(id);
  }), [remember, run]);
  const row = selectedId ? encounters[selectedId] ?? null : null;
  const onIntent = useCallback((intent: WildsRoamingBattleIntent) => run(async () => {
    if (!row?.session) return;
    const card = latest.current.readChallengerCard();
    if (!card || card.card.proof.digest !== row.challengerAsset.proof.digest) throw new Error("The battle creature changed. Restore the pinned creature to continue.");
    remember(await request({ action: "intent", encounterId: row.id, ...card,
      expectedRevision: row.session.revision, expectedTurn: row.session.battle.turn,
      intentId: `move:${crypto.randomUUID()}`, intent, kai: latest.current.getKai() }));
  }), [remember, row, run]);
  const onClaim = useCallback(() => run(async () => {
    if (!row || (row.capturePhase !== "ready" && row.capturePhase !== "captured")) return;
    await latest.current.onClaim(row);
    remember(await request(undefined, row.id));
  }), [remember, row, run]);
  const onClose = useCallback(() => {
    if (sending.current) return;
    if (row?.session?.outcome === "active") { void onIntent({ type: "retreat" }); return; }
    if (row && !row.session && !row.cancelled) { void run(async () => {
      remember(await request({ action: "cancel", encounterId: row.id, kai: latest.current.getKai() })); selection.current = null; persistIds(); setSelectedId(null);
    }); return; }
    selection.current = null; persistIds(); setSelectedId(null);
  }, [onIntent, remember, row, run, persistIds]);
  const phase = row?.capturePhase === "captured" ? "captured" : row?.capturePhase === "ready" ? "offered"
    : row?.capturePhase === "expired" || row?.cancelled ? "ended" : !row?.session ? "waiting"
    : row.session.outcome === "active" ? "battle" : row.session.outcome === "capture-eligible" ? "waiting" : "ended";
  const reports = useMemo(() => Object.values(encounters).filter(item => item.session && item.session.outcome !== "active")
    .map(item => ({ encounterId: item.id, assetId: item.defenderAssetId, events: projectWildsRoamingBattleReport(item.session!) })), [encounters]);
  const resumableEncounter = Object.values(encounters).reverse().find(item => sameWildzPlayerCoordinate(item.challenger.playerId, input.selfId)
    && !item.cancelled && item.capturePhase !== "expired" && (!item.session || item.session.outcome === "active"
      || (item.session.outcome === "capture-eligible" && !(item.capturePhase === "captured" && input.isCaptureRestored?.(item))))) ?? null;
  const resume = () => { if (resumableEncounter) { selection.current = resumableEncounter.id; setSelectedId(resumableEncounter.id); persistIds(); } };
  return { challenge, resume, resumableEncounter, selectedEncounter: row, reports, lockedAssetIds: [...locks.current.keys()],
    dialogProps: { open: Boolean(row), session: row?.session ?? null, pending, error, phase, captureRestored: Boolean(row && input.isCaptureRestored?.(row)), onIntent, onClaim, onClose } as const };
}
