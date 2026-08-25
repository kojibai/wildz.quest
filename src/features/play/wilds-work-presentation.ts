export type WildsWorkPresentationPhase = "idle" | "approach" | "work" | "settle";

export type WildsActiveWorkSource = Readonly<{
  sourceId: string;
  kind: "timber" | "stone";
  position: Readonly<{ x: number; y: number; z: number }>;
  startedAtMs: number;
  settledAtMs: number | null;
}>;

export type WildsResourceBodyProjection = Readonly<{
  vitality: number;
  ringIntensity: number;
  tree: Readonly<{ trunkScale: number; crownScale: number; stumpVisible: boolean; worked: boolean }>;
  rock: Readonly<{ scale: number; fracture: number; fractured: boolean }>;
}>;

function clamp01(value: number) {
  return Math.max(0, Math.min(1, Number.isFinite(value) ? value : 0));
}

export function projectWildsResourceBody(input: Readonly<{
  kind: "timber" | "stone";
  capacity: number;
  availableCapacity: number;
}>): WildsResourceBodyProjection {
  const capacity = Number.isSafeInteger(input.capacity) && input.capacity > 0 ? input.capacity : 1;
  const available = Number.isSafeInteger(input.availableCapacity)
    ? Math.max(0, Math.min(capacity, input.availableCapacity))
    : 0;
  const vitality = clamp01(available / capacity);
  const depleted = 1 - vitality;
  // One ordinary harvest should read at a glance, without making a healthy
  // source appear ruined. Later work compounds into the deeper state change.
  const visibleDepletion = depleted <= 0 ? 0 : clamp01(Math.max(.06, Math.pow(depleted, 2) * .76));
  return Object.freeze({
    vitality,
    ringIntensity: clamp01(.2 + vitality * .8),
    tree: Object.freeze({
      trunkScale: clamp01(1 - visibleDepletion * .72),
      crownScale: clamp01(1 - visibleDepletion),
      stumpVisible: input.kind === "timber" && available === 0,
      worked: input.kind === "timber" && available < capacity
    }),
    rock: Object.freeze({
      scale: clamp01(1 - visibleDepletion),
      fracture: clamp01(depleted),
      fractured: input.kind === "stone" && available < capacity
    })
  });
}

export function projectWildsWorkPresentation(input: Readonly<{
  sourceId: string;
  activeSourceId: string | null;
  commandPending: boolean;
  commandSettled: boolean;
  elapsedMs: number;
  reducedMotion: boolean;
}>) {
  const exact = Boolean(input.activeSourceId) && input.sourceId === input.activeSourceId;
  const elapsedMs = Number.isFinite(input.elapsedMs) ? Math.max(0, input.elapsedMs) : 0;
  let phase: WildsWorkPresentationPhase = "idle";
  if (exact && input.commandSettled) phase = "settle";
  else if (exact && input.commandPending) phase = elapsedMs < 280 ? "approach" : "work";
  const engaged = phase !== "idle";
  const approach = phase === "approach" ? clamp01(elapsedMs / 280) : engaged ? 1 : 0;
  const workWave = phase === "work" && !input.reducedMotion
    ? .35 + Math.abs(Math.sin(elapsedMs / 115 * Math.PI)) * .65
    : 0;
  const settle = phase === "settle" ? clamp01(1 - Math.max(0, elapsedMs - 900) / 700) : 0;
  return Object.freeze({
    phase,
    impact: clamp01(workWave),
    settle,
    companion: Object.freeze({
      engaged,
      approach,
      bob: input.reducedMotion ? 0 : clamp01(workWave * .18),
      pose: phase === "work" ? "work" as const : phase === "settle" ? "curious" as const : "curious" as const
    })
  });
}
