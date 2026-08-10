export type TrainerEncounterPhase =
  | "idle"
  | "recognized"
  | "challenge"
  | "transition"
  | "combat"
  | "result"
  | "returning";

export type TrainerEncounterWorldPosition = {
  x: number;
  z: number;
  heading: number;
};

export type TrainerEncounterResult = {
  outcome: "player_victory" | "trainer_victory" | "fled";
  xp: number;
  bond: number;
  arenaPathStage: number;
};

export type TrainerEncounterState = {
  phase: TrainerEncounterPhase;
  trainerId: string;
  rosterIds: readonly string[];
  repeat: boolean;
  transitionStartedAt: number | null;
  transitionDurationMs: number;
  settlementId: string | null;
  result: TrainerEncounterResult | null;
  returnPosition: TrainerEncounterWorldPosition;
  error: "trainer_encounter_invalid_transition" | "trainer_encounter_roster_required" | "trainer_encounter_settlement_required" | null;
};

export type TrainerEncounterEvent =
  | { type: "recognize" }
  | { type: "open-challenge" }
  | { type: "cancel" }
  | { type: "accept"; rosterIds: readonly string[]; now?: number }
  | { type: "transition-complete" }
  | { type: "skip-transition" }
  | { type: "settlement-committed"; settlementId: string; result: TrainerEncounterResult }
  | { type: "continue" }
  | { type: "rematch" }
  | { type: "return-complete" };

export function shouldDismissTrainerEncounterForExternalCombat(
  phase: TrainerEncounterPhase | null,
  combat: { wildBattleActive: boolean; pvpBattleActive: boolean }
) {
  return Boolean(
    phase
    && (phase === "challenge" || phase === "transition" || phase === "combat" || phase === "result")
    && (combat.wildBattleActive || combat.pvpBattleActive)
  );
}

export function createTrainerEncounter(
  trainerId: string,
  returnPosition: TrainerEncounterWorldPosition,
  options: { repeat?: boolean } = {}
): TrainerEncounterState {
  return {
    phase: "idle",
    trainerId,
    rosterIds: [],
    repeat: options.repeat ?? false,
    transitionStartedAt: null,
    transitionDurationMs: options.repeat ? 480 : 960,
    settlementId: null,
    result: null,
    returnPosition,
    error: null
  };
}

function invalid(state: TrainerEncounterState, error: TrainerEncounterState["error"] = "trainer_encounter_invalid_transition") {
  return { ...state, error };
}

export function advanceTrainerEncounter(state: TrainerEncounterState, event: TrainerEncounterEvent): TrainerEncounterState {
  switch (event.type) {
    case "recognize":
      return state.phase === "idle" ? { ...state, phase: "recognized", error: null } : invalid(state);
    case "open-challenge":
      return state.phase === "recognized" ? { ...state, phase: "challenge", error: null } : invalid(state);
    case "cancel":
      return state.phase === "recognized" || state.phase === "challenge"
        ? { ...state, phase: "idle", rosterIds: [], error: null }
        : invalid(state);
    case "accept":
      if (state.phase !== "challenge") return invalid(state);
      if (event.rosterIds.length === 0) return invalid(state, "trainer_encounter_roster_required");
      return {
        ...state,
        phase: "transition",
        rosterIds: [...event.rosterIds],
        transitionStartedAt: event.now ?? Date.now(),
        settlementId: null,
        result: null,
        error: null
      };
    case "transition-complete":
      return state.phase === "transition" ? { ...state, phase: "combat", error: null } : invalid(state);
    case "skip-transition":
      return state.phase === "transition" && state.repeat ? { ...state, phase: "combat", error: null } : invalid(state);
    case "settlement-committed":
      if (state.phase !== "combat") return invalid(state);
      if (!event.settlementId) return invalid(state, "trainer_encounter_settlement_required");
      return {
        ...state,
        phase: "result",
        settlementId: event.settlementId,
        result: event.result,
        repeat: true,
        error: null
      };
    case "continue":
      return state.phase === "result" ? { ...state, phase: "returning", error: null } : invalid(state);
    case "rematch":
      return state.phase === "result"
        ? {
            ...state,
            phase: "challenge",
            rosterIds: [],
            transitionStartedAt: null,
            transitionDurationMs: 480,
            settlementId: null,
            result: null,
            repeat: true,
            error: null
          }
        : invalid(state);
    case "return-complete":
      return state.phase === "returning"
        ? { ...state, phase: "idle", rosterIds: [], transitionStartedAt: null, error: null }
        : invalid(state);
  }
}
