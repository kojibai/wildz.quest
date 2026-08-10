import type { WildsQualityTier } from "./wilds-quality-profile";

const TIERS: readonly WildsQualityTier[] = ["low", "medium", "high"];
const WINDOW_SIZE = 120;
const SLOW_FRAME_MS = 22;
const HEALTHY_FRAME_MS = 16.7;
const SLOW_FRAMES_TO_LOWER = 120;
const HEALTHY_FRAMES_TO_RAISE = 600;
const COOLDOWN_MS = 30_000;

export type WildsQualityGovernorState = {
  baseTier: WildsQualityTier;
  tier: WildsQualityTier;
  frameWindow: readonly number[];
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

export function createWildsQualityGovernor(baseTier: WildsQualityTier): WildsQualityGovernorState {
  return {
    baseTier,
    tier: baseTier,
    frameWindow: [],
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
  if (!sample.visible) return state;
  const frameMs = Math.max(4, Math.min(100, Number.isFinite(sample.frameMs) ? sample.frameMs : 16.7));
  const clockMs = Math.max(state.clockMs, sample.atMs ?? state.clockMs + frameMs);
  const frameWindow = [...state.frameWindow, frameMs].slice(-WINDOW_SIZE);
  const averageFrameMs = frameWindow.reduce((sum, value) => sum + value, 0) / frameWindow.length;
  const slowFrames = frameMs >= SLOW_FRAME_MS ? state.slowFrames + 1 : 0;
  const healthyFrames = frameMs <= HEALTHY_FRAME_MS ? state.healthyFrames + 1 : 0;
  const canTransition = clockMs >= state.cooldownUntilMs;
  const canRaise = TIERS.indexOf(state.tier) < TIERS.indexOf(state.baseTier);

  if (canTransition && slowFrames >= SLOW_FRAMES_TO_LOWER && state.tier !== "low") {
    return {
      ...state,
      tier: neighboringTier(state.tier, -1),
      frameWindow,
      averageFrameMs,
      slowFrames: 0,
      healthyFrames: 0,
      cooldownUntilMs: clockMs + COOLDOWN_MS,
      clockMs,
      transitions: state.transitions + 1
    };
  }
  if (canTransition && canRaise && healthyFrames >= HEALTHY_FRAMES_TO_RAISE) {
    return {
      ...state,
      tier: neighboringTier(state.tier, 1),
      frameWindow,
      averageFrameMs,
      slowFrames: 0,
      healthyFrames: 0,
      cooldownUntilMs: clockMs + COOLDOWN_MS,
      clockMs,
      transitions: state.transitions + 1
    };
  }
  return { ...state, frameWindow, averageFrameMs, slowFrames, healthyFrames, clockMs };
}
