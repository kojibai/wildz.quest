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

export type WildsCompanionWorkMotion = Readonly<{
  tangent: number;
  radial: number;
  lift: number;
}>;

/** Pure render-time motion. It presents admitted work but never changes authority. */
export function projectWildsCompanionWorkMotion(input: Readonly<{
  elapsedMs: number;
  settledElapsedMs: number | null;
  reducedMotion: boolean;
}>): WildsCompanionWorkMotion {
  if (input.reducedMotion) return Object.freeze({ tangent: 0, radial: 0, lift: 0 });
  const seconds = Math.max(0, Number.isFinite(input.elapsedMs) ? input.elapsedMs : 0) / 1_000;
  if (input.settledElapsedMs !== null) {
    const settle = clamp01(1 - Math.max(0, input.settledElapsedMs) / 850);
    return Object.freeze({
      tangent: Math.sin(seconds * 7.2) * .1 * settle,
      radial: .1 * settle,
      lift: (Math.sin(seconds * 8.4) * .025 + .025) * settle
    });
  }
  return Object.freeze({
    tangent: Math.sin(seconds * 6.8) * .16,
    radial: Math.cos(seconds * 13.6) * .075,
    lift: Math.abs(Math.sin(seconds * 6.8)) * .07
  });
}

export type WildsSourceWorkMotion = Readonly<{
  tiltX: number;
  tiltZ: number;
  lift: number;
  scale: number;
}>;

/** Bounded visual reaction for only the exact active living source. */
export function projectWildsSourceWorkMotion(input: Readonly<{
  kind: "timber" | "stone";
  elapsedMs: number;
  active: boolean;
  reducedMotion: boolean;
}>): WildsSourceWorkMotion {
  if (!input.active || input.reducedMotion) return Object.freeze({ tiltX: 0, tiltZ: 0, lift: 0, scale: 1 });
  const seconds = Math.max(0, Number.isFinite(input.elapsedMs) ? input.elapsedMs : 0) / 1_000;
  if (input.kind === "timber") {
    return Object.freeze({
      tiltX: Math.sin(seconds * 7.1) * .035,
      tiltZ: Math.cos(seconds * 6.2) * .028,
      lift: 0,
      scale: 1 + Math.sin(seconds * 12.4) * .008
    });
  }
  const impact = Math.abs(Math.sin(seconds * 10.8));
  return Object.freeze({
    tiltX: Math.sin(seconds * 8.1) * .018,
    tiltZ: Math.cos(seconds * 7.4) * .018,
    lift: impact * .018,
    scale: 1 + impact * .045
  });
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
