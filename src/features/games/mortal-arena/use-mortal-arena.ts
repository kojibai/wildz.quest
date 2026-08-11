"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { ArenaMode } from "../../play/arena/mode";
import type { PortableCardAsset } from "../../play/portable-card";
import { sealArenaReceipt } from "../../play/arena/receipt";
import { createArenaTranscript } from "../../play/arena/transcript";
import { advanceArenaPath, projectCampaignOpponent, restoreArenaPath, type ArenaCampaignOpponent, type WildzArenaPath } from "./campaign";
import {
  advanceCanonicalArenaSession,
  createCanonicalArenaSession,
  projectCanonicalArenaResult,
  projectCanonicalArenaState,
  type CanonicalArenaSession,
  type CanonicalMortalAdmission
} from "./canonical-adapter";
import { projectMortalityWarning } from "./mortality";
import { ARENA_SETTLEMENT_JOURNAL_PREFIX, createArenaSettlement, recoverArenaSettlement, type ArenaSettlement } from "./settlement";
import type { MortalArenaInput } from "./types";

const PATH_KEY = "wildz:mortal-arena:path:v1";

type SessionProjection = Readonly<{
  session: CanonicalArenaSession;
  unavailableReason: string | null;
}>;

export function createMortalArenaSessionProjection(input: {
  roster: readonly PortableCardAsset[];
  path: WildzArenaPath;
  opponent: ArenaCampaignOpponent;
  mode: ArenaMode;
  mortalAdmission?: CanonicalMortalAdmission;
}, options: Readonly<{ claimMortalAdmission?: boolean }> = {}): SessionProjection {
  if (input.mode === "mortal" && input.mortalAdmission && !options.claimMortalAdmission) {
    const { mortalAdmission: _mortalAdmission, ...practiceInput } = input;
    return {
      session: createCanonicalArenaSession({ ...practiceInput, mode: "practice" }),
      unavailableReason: "mortal_arena_covenant_not_claimed"
    };
  }
  try {
    return { session: createCanonicalArenaSession(input), unavailableReason: null };
  } catch (error) {
    const reason = error instanceof Error ? error.message : "mortal_arena_session_unavailable";
    if (reason !== "mortal_arena_ranked_global_session_required" && reason !== "mortal_arena_signed_covenant_required") throw error;
    // A non-interactive Practice projection keeps the existing scene readable while
    // Ranked and Mortal remain fail-closed until their verified envelopes are supplied.
    const { mortalAdmission: _mortalAdmission, ...practiceInput } = input;
    return { session: createCanonicalArenaSession({ ...practiceInput, mode: "practice" }), unavailableReason: reason };
  }
}

export function useMortalArena({ active, roster, onCommit, requestedOpponent = null, mode = "adventure", mortalAdmission }: {
  active: boolean;
  roster: readonly PortableCardAsset[];
  onCommit: (settlement: ArenaSettlement, path: WildzArenaPath) => void;
  requestedOpponent?: ArenaCampaignOpponent | null;
  mode?: ArenaMode;
  mortalAdmission?: CanonicalMortalAdmission;
}) {
  const leader = roster[0]!;
  const initialPath = useMemo(() => typeof window === "undefined" ? restoreArenaPath(null, leader.manifest.ownerReceizId) : restoreArenaPath(window.localStorage.getItem(PATH_KEY), leader.manifest.ownerReceizId), [leader.manifest.ownerReceizId]);
  const initialOpponent = useMemo(() => requestedOpponent ?? projectCampaignOpponent(initialPath), [initialPath, requestedOpponent]);
  const initial = useMemo(() => createMortalArenaSessionProjection({ roster, path: initialPath, opponent: initialOpponent, mode, mortalAdmission }), [initialOpponent, initialPath, mode, mortalAdmission, roster]);
  const [path, setPath] = useState(initialPath);
  const [opponent, setOpponent] = useState(initialOpponent);
  const [projection, setProjection] = useState<SessionProjection>(initial);
  const [settlement, setSettlement] = useState<ArenaSettlement | null>(null);
  const [impactTick, setImpactTick] = useState(0);
  const movementRef = useRef({ x: 0, z: 0 });
  const pulseRef = useRef<Partial<MortalArenaInput>>({});
  const heldRef = useRef<Pick<MortalArenaInput, "guard" | "flee">>({});
  const settledMatchRef = useRef<string | null>(null);
  const initialState = projectCanonicalArenaState(initial.session);
  const previousVitalityRef = useRef(initialState.sides[0].fighters[0]!.vitality + initialState.sides[1].fighters[0]!.vitality);

  const resetForPath = useCallback((nextPath: WildzArenaPath) => {
    const nextOpponent = requestedOpponent ?? projectCampaignOpponent(nextPath);
    const next = createMortalArenaSessionProjection({ roster, path: nextPath, opponent: nextOpponent, mode, mortalAdmission });
    setOpponent(nextOpponent);
    setProjection(next);
    setSettlement(null);
    settledMatchRef.current = null;
    const nextState = projectCanonicalArenaState(next.session);
    previousVitalityRef.current = nextState.sides[0].fighters[0]!.vitality + nextState.sides[1].fighters[0]!.vitality;
  }, [mode, mortalAdmission, requestedOpponent, roster]);

  const claimMortalAdmission = useCallback(() => {
    if (mode !== "mortal" || !mortalAdmission) return false;
    try {
      const next = createMortalArenaSessionProjection(
        { roster, path, opponent, mode, mortalAdmission },
        { claimMortalAdmission: true }
      );
      setProjection(next);
      setSettlement(null);
      settledMatchRef.current = null;
      const nextState = projectCanonicalArenaState(next.session);
      previousVitalityRef.current = nextState.sides[0].fighters[0]!.vitality + nextState.sides[1].fighters[0]!.vitality;
      return next.unavailableReason === null;
    } catch {
      return false;
    }
  }, [mode, mortalAdmission, opponent, path, roster]);

  const state = projectCanonicalArenaState(projection.session);
  const result = projectCanonicalArenaResult(projection.session);
  const playable = active && !projection.unavailableReason;

  useEffect(() => {
    if (!playable || state.phase === "complete" || settlement) return;
    const timer = window.setInterval(() => {
      setProjection((current) => {
        let next = current.session;
        for (let step = 0; step < 2 && !next.canonical.terminal; step += 1) {
          const playerInput: MortalArenaInput = {
            moveX: Math.round(movementRef.current.x * 1_000),
            moveZ: Math.round(movementRef.current.z * 1_000),
            ...heldRef.current,
            ...(step === 0 ? pulseRef.current : {})
          };
          if (step === 0) pulseRef.current = {};
          next = advanceCanonicalArenaSession(next, playerInput);
        }
        const view = projectCanonicalArenaState(next);
        const vitality = view.sides[0].fighters[view.sides[0].activeIndex]!.vitality + view.sides[1].fighters[view.sides[1].activeIndex]!.vitality;
        if (vitality < previousVitalityRef.current) setImpactTick(view.tick);
        previousVitalityRef.current = vitality;
        return { ...current, session: next };
      });
    }, 33);
    return () => window.clearInterval(timer);
  }, [playable, settlement, state.phase]);

  useEffect(() => {
    if (!playable || !result || settledMatchRef.current === result.matchId) return;
    settledMatchRef.current = result.matchId;
    const completedAt = new Date().toISOString();
    const canonicalReceipt = sealArenaReceipt({
      definition: projection.session.definition,
      transcript: createArenaTranscript(projection.session.definition, projection.session.canonical, projection.session.verification),
      priorConditions: Object.fromEntries(projection.session.definition.teams.flatMap((team) => team.fighters.map((fighter) => [fighter.assetId, fighter.condition]))),
      encounterId: opponent.id,
      checkpointId: `arena:path:${path.checkpointDigest}`,
      actorId: path.playerId,
      authority: { kind: "offline-pending", deviceId: `arena-device:${leader.proof.digest.slice(7, 23)}` },
      publication: { state: "pending", revision: 0 },
      createdAt: completedAt
    }, projection.session.verification);
    const pending = createArenaSettlement({ cards: roster, result, playerSide: 0, completedAt, canonicalReceipt, verification: projection.session.verification });
    const key = `${ARENA_SETTLEMENT_JOURNAL_PREFIX}${pending.id}`;
    window.localStorage.setItem(key, JSON.stringify(pending));
    const committed = recoverArenaSettlement(pending, projection.session.verification);
    window.localStorage.setItem(key, JSON.stringify(committed));
    const nextPath = advanceArenaPath(path, result);
    window.localStorage.setItem(PATH_KEY, JSON.stringify(nextPath));
    setPath(nextPath);
    setSettlement(committed);
    onCommit(committed, nextPath);
  }, [leader.proof.digest, onCommit, opponent.id, path, playable, projection.session, result, roster]);

  useEffect(() => {
    const down = (event: KeyboardEvent) => {
      if (!playable) return;
      if (event.target instanceof HTMLElement && event.target.matches("input, textarea, select, button, [contenteditable='true']")) return;
      const key = event.key.toLowerCase();
      if (key === "w" || key === "arrowup") movementRef.current.z = -1;
      if (key === "s" || key === "arrowdown") movementRef.current.z = 1;
      if (key === "a" || key === "arrowleft") movementRef.current.x = -1;
      if (key === "d" || key === "arrowright") movementRef.current.x = 1;
      if (key === " ") pulseRef.current.light = true;
      if (key === "e") pulseRef.current.dodge = true;
      if (key === "r") pulseRef.current.parry = true;
      if (key === "f") pulseRef.current.focus = true;
      if (key === "1") pulseRef.current.abilitySlot = 0;
      if (key === "q") pulseRef.current.swapTo = (state.sides[0].activeIndex + 1) % state.sides[0].fighters.length;
      if (key === "shift") heldRef.current.guard = true;
    };
    const up = (event: KeyboardEvent) => {
      const key = event.key.toLowerCase();
      if ((key === "w" || key === "arrowup") && movementRef.current.z < 0) movementRef.current.z = 0;
      if ((key === "s" || key === "arrowdown") && movementRef.current.z > 0) movementRef.current.z = 0;
      if ((key === "a" || key === "arrowleft") && movementRef.current.x < 0) movementRef.current.x = 0;
      if ((key === "d" || key === "arrowright") && movementRef.current.x > 0) movementRef.current.x = 0;
      if (key === "shift") heldRef.current.guard = false;
    };
    window.addEventListener("keydown", down);
    window.addEventListener("keyup", up);
    return () => { window.removeEventListener("keydown", down); window.removeEventListener("keyup", up); };
  }, [playable, state.sides]);

  const activeFighter = state.sides[0].fighters[state.sides[0].activeIndex]!;
  const rival = state.sides[1].fighters[state.sides[1].activeIndex]!;
  return {
    state,
    path,
    opponent,
    settlement,
    result,
    impactTick,
    mode,
    unavailableReason: projection.unavailableReason,
    claimMortalAdmission,
    warning: projectMortalityWarning(activeFighter, Math.max(72, rival.power)),
    setMovement: (x: number, z: number) => { movementRef.current = { x, z }; },
    pulse: (input: Partial<MortalArenaInput>) => { pulseRef.current = { ...pulseRef.current, ...input }; },
    hold: (input: "guard" | "flee", activeHold: boolean) => { heldRef.current[input] = activeHold; },
    continuePath: () => resetForPath(path)
  };
}
