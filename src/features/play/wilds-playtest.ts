/** Deliberately accepts no identity, location, free text, or network metadata. */
export const WILDS_PLAYTEST_ACTIONS = ["harvest", "placement", "panel", "discovery", "home", "save", "delight", "hesitation"] as const;
export type WildsPlaytestAction = (typeof WILDS_PLAYTEST_ACTIONS)[number];
export type WildsPlaytestOutcome = "start" | "success" | "failure";
export const WILDS_PLAYTEST_SAMPLE_LIMIT = 600;
export const WILDS_PLAYTEST_EVENT_LIMIT = 120;
export type WildsPlaytestEvent = { action: WildsPlaytestAction; outcome: WildsPlaytestOutcome; elapsedMs: number; durationMs?: number };
export type WildsPlaytestSummary = {
  sampledFrames: number; frameGapsOver50ms: number; worstFrameMs: number; recentFrameP95Ms: number;
  longTasks: number; worstLongTaskMs: number; events: number; delighted: number; hesitations: number;
};
export type WildsPlaytestRecording = {
  startedAt: number;
  frames: number[];
  events: WildsPlaytestEvent[];
  pending: Partial<Record<WildsPlaytestAction, number>>;
  summary: WildsPlaytestSummary;
};
export function createWildsPlaytestRecording(now: number): WildsPlaytestRecording {
  return { startedAt: now, frames: [], events: [], pending: {}, summary: {
    sampledFrames: 0, frameGapsOver50ms: 0, worstFrameMs: 0, recentFrameP95Ms: 0,
    longTasks: 0, worstLongTaskMs: 0, events: 0, delighted: 0, hesitations: 0
  } };
}
function boundedPush<T>(values: T[], value: T, limit: number) {
  if (values.length === limit) values.shift();
  values.push(value);
}
export function recordWildsPlaytestFrame(recording: WildsPlaytestRecording, durationMs: number): void {
  if (!Number.isFinite(durationMs) || durationMs <= 0) return;
  boundedPush(recording.frames, durationMs, WILDS_PLAYTEST_SAMPLE_LIMIT);
  recording.summary.sampledFrames++;
  if (durationMs > 50) recording.summary.frameGapsOver50ms++;
  recording.summary.worstFrameMs = Math.max(recording.summary.worstFrameMs, durationMs);
}
export function recordWildsPlaytestLongTask(recording: WildsPlaytestRecording, durationMs: number): void {
  if (!Number.isFinite(durationMs) || durationMs < 50) return;
  recording.summary.longTasks++;
  recording.summary.worstLongTaskMs = Math.max(recording.summary.worstLongTaskMs, durationMs);
}
export function markWildsPlaytest(recording: WildsPlaytestRecording, action: WildsPlaytestAction, outcome: WildsPlaytestOutcome, now: number): void {
  // Runtime validation keeps accidentally supplied strings out of exported evidence too.
  if (!WILDS_PLAYTEST_ACTIONS.includes(action) || !["start", "success", "failure"].includes(outcome) || !Number.isFinite(now) || now < recording.startedAt) return;
  const start = recording.pending[action];
  if (outcome === "start") recording.pending[action] = now;
  else delete recording.pending[action];
  const event: WildsPlaytestEvent = { action, outcome, elapsedMs: Math.round(now - recording.startedAt) };
  if (outcome !== "start" && start !== undefined && now >= start) event.durationMs = Math.round(now - start);
  boundedPush(recording.events, event, WILDS_PLAYTEST_EVENT_LIMIT);
  recording.summary.events++;
  if (outcome === "success" && action === "delight") recording.summary.delighted++;
  if (outcome === "success" && action === "hesitation") recording.summary.hesitations++;
}
export function summarizeWildsPlaytest(recording: WildsPlaytestRecording): WildsPlaytestSummary {
  const sorted = [...recording.frames].sort((a, b) => a - b);
  return { ...recording.summary, recentFrameP95Ms: Math.round(sorted[Math.max(0, Math.ceil(sorted.length * .95) - 1)] ?? 0),
    worstFrameMs: Math.round(recording.summary.worstFrameMs), worstLongTaskMs: Math.round(recording.summary.worstLongTaskMs) };
}
export function exportWildsPlaytest(recording: WildsPlaytestRecording, longTasksSupported: boolean) {
  return {
    version: "wildz.local-playtest.v1", scope: "visible-tab animation-frame timing; not GPU render timing",
    retention: { recentFrames: WILDS_PLAYTEST_SAMPLE_LIMIT, recentEvents: WILDS_PLAYTEST_EVENT_LIMIT },
    longTasksSupported, summary: summarizeWildsPlaytest(recording), events: recording.events.map(event => ({ ...event }))
  };
}
