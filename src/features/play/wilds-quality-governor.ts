import type { WildsQualityTier } from "./wilds-quality-profile";

const TIERS: readonly WildsQualityTier[] = ["low", "medium", "high"];
const WINDOW_SIZE = 120;
const SLOW_FRAME_MS = 22;
const HEALTHY_FRAME_MS = 16.7;
const SLOW_FRAMES_TO_LOWER = 120;
const HEALTHY_FRAMES_TO_RAISE = 600;
const COOLDOWN_MS = 30_000;
const QUALITY_TIER_STORAGE_KEY = "wildz:quality:v1";

type WildsQualityStorage = Pick<Storage, "getItem" | "setItem">;

export type WildsQualityGovernorState = {
  baseTier: WildsQualityTier;
  tier: WildsQualityTier;
  frameWindow: readonly number[];
  frameWindowCursor: number;
  frameWindowTotal: number;
  averageFrameMs: number;
  slowFrames: number;
  healthyFrames: number;
  cooldownUntilMs: number;
  clockMs: number;
  transitions: number;
};

export type WildsQualityFrameSample = {
  frameMs: number;
  visible: boolean;
  atMs?: number;
};

function tierAtOrBelow(candidate: WildsQualityTier, baseTier: WildsQualityTier): WildsQualityTier {
  return TIERS[Math.min(TIERS.indexOf(candidate), TIERS.indexOf(baseTier))]!;
}

export function readWildsLearnedQualityTier(storage: Pick<WildsQualityStorage, "getItem"> | null, baseTier: WildsQualityTier): WildsQualityTier {
  if (!storage) return baseTier;
  try {
    const stored = storage.getItem(QUALITY_TIER_STORAGE_KEY);
    return stored === "low" || stored === "medium" || stored === "high" ? tierAtOrBelow(stored, baseTier) : baseTier;
  } catch {
    return baseTier;
  }
}

export function writeWildsLearnedQualityTier(storage: Pick<WildsQualityStorage, "setItem"> | null, tier: WildsQualityTier): void {
  if (!storage) return;
  try {
    storage.setItem(QUALITY_TIER_STORAGE_KEY, tier);
  } catch {
    // Quality memory is optional in restricted/private browsing contexts.
  }
}

export function createWildsQualityGovernor(baseTier: WildsQualityTier, initialTier: WildsQualityTier = baseTier): WildsQualityGovernorState {
  return {
    baseTier,
    tier: tierAtOrBelow(initialTier, baseTier),
    frameWindow: [],
    frameWindowCursor: 0,
    frameWindowTotal: 0,
    averageFrameMs: 0,
    slowFrames: 0,
    healthyFrames: 0,
    cooldownUntilMs: 0,
    clockMs: 0,
    transitions: 0
  };
}

function neighboringTier(tier: WildsQualityTier, direction: -1 | 1) {
  const index = TIERS.indexOf(tier);
  return TIERS[Math.max(0, Math.min(TIERS.length - 1, index + direction))]!;
}

export function updateWildsQualityGovernor(
  state: WildsQualityGovernorState,
  sample: WildsQualityFrameSample
): WildsQualityGovernorState {
  return writeWildsQualityGovernor(state, sample.frameMs, sample.visible, sample.atMs);
}

export function writeWildsQualityGovernor(
  state: WildsQualityGovernorState,
  sampleFrameMs: number,
  visible: boolean,
  atMs?: number
): WildsQualityGovernorState {
  if (!visible) return state;
  const frameMs = Math.max(4, Math.min(100, Number.isFinite(sampleFrameMs) ? sampleFrameMs : 16.7));
  const clockMs = Math.max(state.clockMs, atMs ?? state.clockMs + frameMs);
  const frameWindow = state.frameWindow as number[];
  let frameWindowCursor = state.frameWindowCursor;
  let frameWindowTotal = state.frameWindowTotal;
  if (frameWindow.length < WINDOW_SIZE) {
    frameWindow.push(frameMs);
    frameWindowTotal += frameMs;
    frameWindowCursor = frameWindow.length % WINDOW_SIZE;
  } else {
    frameWindowTotal += frameMs - frameWindow[frameWindowCursor]!;
    frameWindow[frameWindowCursor] = frameMs;
    frameWindowCursor = (frameWindowCursor + 1) % WINDOW_SIZE;
  }
  const averageFrameMs = frameWindowTotal / frameWindow.length;
  const slowFrames = frameMs >= SLOW_FRAME_MS ? state.slowFrames + 1 : 0;
  const healthyFrames = frameMs <= HEALTHY_FRAME_MS ? state.healthyFrames + 1 : 0;
  const canTransition = clockMs >= state.cooldownUntilMs;
  const canRaise = TIERS.indexOf(state.tier) < TIERS.indexOf(state.baseTier);

  if (canTransition && slowFrames >= SLOW_FRAMES_TO_LOWER && state.tier !== "low") {
    state.tier = neighboringTier(state.tier, -1);
    state.slowFrames = 0;
    state.healthyFrames = 0;
    state.cooldownUntilMs = clockMs + COOLDOWN_MS;
    state.transitions += 1;
  } else if (canTransition && canRaise && healthyFrames >= HEALTHY_FRAMES_TO_RAISE) {
    state.tier = neighboringTier(state.tier, 1);
    state.slowFrames = 0;
    state.healthyFrames = 0;
    state.cooldownUntilMs = clockMs + COOLDOWN_MS;
    state.transitions += 1;
  } else {
    state.slowFrames = slowFrames;
    state.healthyFrames = healthyFrames;
  }
  state.frameWindowCursor = frameWindowCursor;
  state.frameWindowTotal = frameWindowTotal;
  state.averageFrameMs = averageFrameMs;
  state.clockMs = clockMs;
  return state;
}
