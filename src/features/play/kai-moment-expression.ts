import type { KaiKlokMoment } from "./kai-klok-moment";

export type KaiDayPhase = "sunrise" | "morning" | "midday" | "afternoon" | "twilight" | "night";

export type KaiWorldExpression = {
  accent: string;
  dayPhase: KaiDayPhase;
  dayProgress: number;
  arkProgress: number;
  atmosphericInfluence: number;
  sun: { azimuth: number; elevation: number; intensity: number; color: string };
  celestial: {
    moon: { azimuth: number; elevation: number; intensity: number; color: string };
  };
  sky: { tint: string; zenith: string; horizon: string; luminance: number; fogDensity: number };
  lighting: { hemisphere: number; fill: number; rim: number; shadow: number };
  night: { amount: number; starOpacity: number; constellationOpacity: number; predawn: number };
  particles: { speed: number; opacity: number; geometrySides: number };
  transitionKey: { day: string; beat: string; ark: string };
  /** @deprecated Use particles.speed. */
  particleSpeed: number;
  /** @deprecated Use particles.geometrySides. */
  geometrySides: number;
};

export type KaiTransitionKind = "beat" | "ark";

export function kaiTransition(previous: KaiWorldExpression["transitionKey"] | null, next: KaiWorldExpression["transitionKey"]): KaiTransitionKind | null {
  if (!previous) return null;
  if (previous.ark !== next.ark || previous.day !== next.day) return "ark";
  if (previous.beat !== next.beat) return "beat";
  return null;
}

const PHASES = ["sunrise", "morning", "midday", "afternoon", "twilight", "night"] as const;
const TARGETS = [
  { elevation: 0.03, intensity: 0.72, luminance: 0.62, fog: 0.026, hemisphere: 0.64, fill: 0.44, rim: 0.2, shadow: 0.42, particles: 0.34, sun: "#ffd0a2", zenith: "#426b8a", horizon: "#f1a47e" },
  { elevation: 0.48, intensity: 0.96, luminance: 0.84, fog: 0.018, hemisphere: 0.86, fill: 0.62, rim: 0.16, shadow: 0.58, particles: 0.22, sun: "#fff1c7", zenith: "#6db7d2", horizon: "#b9e5ea" },
  { elevation: 0.92, intensity: 1.12, luminance: 1, fog: 0.014, hemisphere: 1, fill: 0.72, rim: 0.14, shadow: 0.68, particles: 0.16, sun: "#fff8df", zenith: "#75bdd7", horizon: "#c4ebf4" },
  { elevation: 0.5, intensity: 0.91, luminance: 0.82, fog: 0.019, hemisphere: 0.82, fill: 0.57, rim: 0.18, shadow: 0.56, particles: 0.24, sun: "#ffe0ae", zenith: "#789eb7", horizon: "#e7c89d" },
  { elevation: 0.06, intensity: 0.58, luminance: 0.5, fog: 0.03, hemisphere: 0.54, fill: 0.38, rim: 0.22, shadow: 0.34, particles: 0.46, sun: "#ffad85", zenith: "#2e3157", horizon: "#ba6f6f" },
  { elevation: -0.28, intensity: 0.02, luminance: 0.07, fog: 0.042, hemisphere: 0.1, fill: 0.16, rim: 0.28, shadow: 0.18, particles: 0.68, sun: "#aebeff", zenith: "#030611", horizon: "#101a32" }
] as const;

const lerp = (from: number, to: number, progress: number) => from + (to - from) * progress;
const smooth = (value: number) => value * value * (3 - 2 * value);
const clamp01 = (value: number) => Math.max(0, Math.min(1, value));
const smoothRange = (from: number, to: number, value: number) => smooth(clamp01((value - from) / (to - from)));

function mixHex(from: string, to: string, progress: number) {
  const channel = (hex: string, offset: number) => Number.parseInt(hex.slice(offset, offset + 2), 16);
  const value = [1, 3, 5].map((offset) => Math.round(lerp(channel(from, offset), channel(to, offset), progress)).toString(16).padStart(2, "0"));
  return `#${value.join("")}`;
}

export function projectKaiWorldExpression(moment: KaiKlokMoment): KaiWorldExpression {
  const current = TARGETS[moment.arkIndex] ?? TARGETS[0];
  const next = TARGETS[(moment.arkIndex + 1) % TARGETS.length] ?? TARGETS[0];
  // Dream remains a true night for most of its Ark. Only the final four per
  // cent of the Kai day is predawn, ending at the 00:00:00 sunrise boundary.
  const predawn = moment.arkIndex === 5 ? smoothRange(0.96, 1, moment.dayProgress) : 0;
  const progress = moment.arkIndex === 5 ? predawn : smooth(moment.arkProgress);
  const nightRise = smoothRange(4 / 6, 5 / 6, moment.dayProgress);
  const nightAmount = clamp01(nightRise * (1 - predawn));
  const dayKey = `${moment.year}:${moment.month}:${moment.day}`;
  const particleSpeed = 0.16 + moment.pulseInStep / 120 + current.particles * 0.22;
  const geometrySides = moment.sides;
  return {
    accent: moment.accent,
    dayPhase: PHASES[moment.arkIndex] ?? "sunrise",
    dayProgress: moment.dayProgress,
    arkProgress: moment.arkProgress,
    atmosphericInfluence: Math.min(0.18, 0.08 + current.particles * 0.08),
    sun: {
      azimuth: moment.dayProgress * Math.PI * 2 - Math.PI / 2,
      elevation: lerp(current.elevation, next.elevation, progress),
      intensity: lerp(current.intensity, next.intensity, progress),
      color: mixHex(current.sun, next.sun, progress)
    },
    celestial: {
      moon: {
        azimuth: moment.dayProgress * Math.PI * 2 + Math.PI / 2,
        elevation: lerp(0.08, 0.46, nightAmount),
        intensity: lerp(0.02, 0.28, nightAmount),
        color: mixHex("#d8e1ff", "#aebeff", nightAmount)
      }
    },
    sky: {
      tint: mixHex(current.horizon, next.horizon, progress),
      zenith: mixHex(current.zenith, next.zenith, progress),
      horizon: mixHex(current.horizon, next.horizon, progress),
      luminance: lerp(current.luminance, next.luminance, progress),
      fogDensity: lerp(current.fog, next.fog, progress)
    },
    lighting: {
      hemisphere: lerp(current.hemisphere, next.hemisphere, progress),
      fill: lerp(current.fill, next.fill, progress),
      rim: lerp(current.rim, next.rim, progress),
      shadow: lerp(current.shadow, next.shadow, progress)
    },
    night: {
      amount: nightAmount,
      starOpacity: smoothRange(0.08, 0.82, nightAmount),
      constellationOpacity: smoothRange(0.2, 0.95, nightAmount) * 0.88,
      predawn
    },
    particles: { speed: particleSpeed, opacity: current.particles, geometrySides },
    transitionKey: {
      day: dayKey,
      beat: `${dayKey}:${moment.beat}`,
      ark: `${dayKey}:${moment.arkIndex}`
    },
    particleSpeed,
    geometrySides
  };
}
