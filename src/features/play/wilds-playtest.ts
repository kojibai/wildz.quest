/** Deliberately accepts no identity, location, free text, or network metadata. */
export const WILDS_PLAYTEST_ACTIONS = ["harvest", "placement", "panel", "discovery", "home", "save", "delight", "hesitation", "profile", "market", "identity-save", "card-save"] as const;
export type WildsPlaytestAction = (typeof WILDS_PLAYTEST_ACTIONS)[number];
export type WildsPlaytestOutcome = "start" | "success" | "failure";
export const WILDS_PLAYTEST_SAMPLE_LIMIT = 600;
export const WILDS_PLAYTEST_EVENT_LIMIT = 120;
export type WildsPlaytestEvent = { action: WildsPlaytestAction; outcome: WildsPlaytestOutcome; elapsedMs: number; durationMs?: number };
export type WildsPlaytestSummary = {
  sampledFrames: number; frameGapsOver50ms: number; worstFrameMs: number; recentFrameP95Ms: number;
  longTasks: number; worstLongTaskMs: number; events: number; delighted: number; hesitations: number;
};
export type WildsPlaytestSlowInterval = { kind: "frame-gap" | "long-task"; elapsedMs: number; durationMs: number };
export type WildsPlaytestRecording = {
  slowIntervals: WildsPlaytestSlowInterval[];
  startedAt: number;
  frames: number[];
  events: WildsPlaytestEvent[];
  pending: Partial<Record<WildsPlaytestAction, number>>;
  summary: WildsPlaytestSummary;
};
export function createWildsPlaytestRecording(now: number): WildsPlaytestRecording {
  return { startedAt: now, frames: [], events: [], slowIntervals: [], pending: {}, summary: {
    sampledFrames: 0, frameGapsOver50ms: 0, worstFrameMs: 0, recentFrameP95Ms: 0,
    longTasks: 0, worstLongTaskMs: 0, events: 0, delighted: 0, hesitations: 0
  } };
}
function boundedPush<T>(values: T[], value: T, limit: number) {
  if (values.length === limit) values.shift();
  values.push(value);
}
export function recordWildsPlaytestFrame(recording: WildsPlaytestRecording, durationMs: number, endedAt?: number): void {
  if (!Number.isFinite(durationMs) || durationMs <= 0 || (endedAt !== undefined && (!Number.isFinite(endedAt) || endedAt - durationMs < recording.startedAt))) return;
  boundedPush(recording.frames, durationMs, WILDS_PLAYTEST_SAMPLE_LIMIT);
  recording.summary.sampledFrames++;
  if (durationMs > 50) {
    recording.summary.frameGapsOver50ms++;
    recordSlowInterval(recording, "frame-gap", durationMs, endedAt);
  }
  recording.summary.worstFrameMs = Math.max(recording.summary.worstFrameMs, durationMs);
}
export function recordWildsPlaytestLongTask(recording: WildsPlaytestRecording, durationMs: number, endedAt?: number): void {
  if (!Number.isFinite(durationMs) || durationMs < 50 || (endedAt !== undefined && (!Number.isFinite(endedAt) || endedAt - durationMs < recording.startedAt))) return;
  recording.summary.longTasks++;
  recordSlowInterval(recording, "long-task", durationMs, endedAt);
  recording.summary.worstLongTaskMs = Math.max(recording.summary.worstLongTaskMs, durationMs);
}
function recordSlowInterval(recording: WildsPlaytestRecording, kind: WildsPlaytestSlowInterval["kind"], durationMs: number, endedAt?: number) {
  if (endedAt === undefined || !Number.isFinite(endedAt) || endedAt - durationMs < recording.startedAt) return;
  boundedPush(recording.slowIntervals, { kind, elapsedMs: Math.round(endedAt - durationMs - recording.startedAt), durationMs: Math.round(durationMs) }, WILDS_PLAYTEST_EVENT_LIMIT);
}
/** Correlation is temporal overlap, never a claim that an action caused a stall. */
export function correlateWildsPlaytest(recording: WildsPlaytestRecording) {
  return recording.slowIntervals.map(interval => ({ ...interval, overlappingActions: WILDS_PLAYTEST_ACTIONS.filter(action => {
    const end = interval.elapsedMs + interval.durationMs;
    const pending = recording.pending[action];
    if (pending !== undefined && pending - recording.startedAt <= end) return true;
    return recording.events.some(event => event.action === action && event.durationMs !== undefined &&
      event.elapsedMs >= interval.elapsedMs && event.elapsedMs - event.durationMs <= end);
  }) }));
}
export function summarizeWildsPlaytestActions(recording: WildsPlaytestRecording) {
  return WILDS_PLAYTEST_ACTIONS.flatMap(action => {
    const completions = recording.events.filter(event => event.action === action && event.outcome !== "start" && event.durationMs !== undefined);
    if (!completions.length) return [];
    const durations = completions.map(event => event.durationMs!).sort((a, b) => a - b);
    return [{ action, completed: completions.length, failures: completions.filter(event => event.outcome === "failure").length,
      p95Ms: durations[Math.ceil(durations.length * .95) - 1], worstMs: durations[durations.length - 1] }];
  });
}
export function markWildsPlaytest(recording: WildsPlaytestRecording, action: WildsPlaytestAction, outcome: WildsPlaytestOutcome, now: number): void {
  // Runtime validation keeps accidentally supplied strings out of exported evidence too.
  if (!WILDS_PLAYTEST_ACTIONS.includes(action) || !["start", "success", "failure"].includes(outcome) || !Number.isFinite(now) || now < recording.startedAt) return;
  const start = recording.pending[action];
  if (outcome === "start") {
    // A category cannot pair concurrent requests reliably. Keep the first start instead of understating latency.
    if (start !== undefined) return;
    recording.pending[action] = now;
  }
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
    version: "wildz.local-playtest.v2", scope: "visible-tab animation-frame timing; not GPU render timing",
    retention: { recentFrames: WILDS_PLAYTEST_SAMPLE_LIMIT, recentEvents: WILDS_PLAYTEST_EVENT_LIMIT, recentSlowIntervals: WILDS_PLAYTEST_EVENT_LIMIT },
    attribution: "Temporal overlap only; action durations include animation and network waits. Unmarked work is unattributed.",
    slowIntervals: correlateWildsPlaytest(recording), actionTimings: summarizeWildsPlaytestActions(recording),
    longTasksSupported, summary: summarizeWildsPlaytest(recording), events: recording.events.map(event => ({ ...event }))
  };
}

/** Conservative regression gate for a visible-tab recording, not a device certification. */
export function assessWildsPlaytestPerformance(evidence: unknown) {
  const limits = { minimumFrames: 600, recentP95Ms: 18, worstFrameMs: 50, longTasks: 0 };
  const incomplete = (reason: string) => ({ status: "incomplete" as const, limits, reasons: [reason] });
  if (!evidence || typeof evidence !== "object") return incomplete("Missing playtest evidence.");
  const data = evidence as { version?: unknown; summary?: unknown; longTasksSupported?: unknown };
  if (data.version !== "wildz.local-playtest.v2" || !data.summary || typeof data.summary !== "object") return incomplete("Expected a v2 local playtest export.");
  const summary = data.summary as Record<string, unknown>;
  for (const key of ["sampledFrames", "recentFrameP95Ms", "worstFrameMs", "frameGapsOver50ms", "longTasks"]) {
    if (typeof summary[key] !== "number" || !Number.isFinite(summary[key]) || summary[key] < 0) return incomplete(`Invalid ${key}.`);
  }
  if ((summary.sampledFrames as number) < limits.minimumFrames) return incomplete("Record at least 600 visible frames after warmup.");
  if (data.longTasksSupported !== true) return incomplete("Long-task observation was unavailable; main-thread stalls remain unverified.");
  const reasons: string[] = [];
  if ((summary.recentFrameP95Ms as number) > limits.recentP95Ms) reasons.push("Recent frame p95 exceeds 18 ms.");
  if ((summary.worstFrameMs as number) > limits.worstFrameMs || (summary.frameGapsOver50ms as number) > 0) reasons.push("A frame gap exceeded 50 ms.");
  if ((summary.longTasks as number) > limits.longTasks) reasons.push("Main-thread tasks exceeded 50 ms.");
  return { status: reasons.length ? "fail" as const : "pass" as const, limits, reasons };
}
