import type { KaiKlokMoment } from "./kai-klok-moment";

export type KaiWorldExpression = {
  accent: string;
  dayPhase: "sunrise" | "morning" | "midday" | "afternoon" | "twilight" | "night";
  dayProgress: number;
  arkProgress: number;
  atmosphericInfluence: number;
  sun: { azimuth: number; elevation: number; intensity: number; color: string };
  sky: { tint: string; luminance: number; fogDensity: number };
  lighting: { hemisphere: number; fill: number; shadow: number };
  particles: { speed: number; opacity: number; geometrySides: number };
  transitionKey: { day: string; beat: string; ark: string };
  /** @deprecated Use particles.speed. */
  particleSpeed: number;
  /** @deprecated Use particles.geometrySides. */
  geometrySides: number;
};

const PHASES = ["sunrise", "morning", "midday", "afternoon", "twilight", "night"] as const;
const TARGETS = [
  { elevation: 0.03, intensity: 0.72, luminance: 0.62, fog: 0.026, hemisphere: 0.64, fill: 0.44, shadow: 0.42, particles: 0.34, sun: "#ffd0a2", sky: "#f1a47e" },
  { elevation: 0.48, intensity: 0.96, luminance: 0.84, fog: 0.018, hemisphere: 0.86, fill: 0.62, shadow: 0.58, particles: 0.22, sun: "#fff1c7", sky: "#8fc9dc" },
  { elevation: 0.92, intensity: 1.12, luminance: 1, fog: 0.014, hemisphere: 1, fill: 0.72, shadow: 0.68, particles: 0.16, sun: "#fff8df", sky: "#75bdd7" },
  { elevation: 0.5, intensity: 0.91, luminance: 0.82, fog: 0.019, hemisphere: 0.82, fill: 0.57, shadow: 0.56, particles: 0.24, sun: "#ffe0ae", sky: "#8eb9c9" },
  { elevation: 0.06, intensity: 0.58, luminance: 0.5, fog: 0.03, hemisphere: 0.54, fill: 0.38, shadow: 0.34, particles: 0.46, sun: "#ffad85", sky: "#766f9c" },
  { elevation: -0.22, intensity: 0.2, luminance: 0.24, fog: 0.036, hemisphere: 0.3, fill: 0.22, shadow: 0.2, particles: 0.68, sun: "#b8c8ff", sky: "#172540" }
] as const;

const lerp = (from: number, to: number, progress: number) => from + (to - from) * progress;
const smooth = (value: number) => value * value * (3 - 2 * value);

function mixHex(from: string, to: string, progress: number) {
  const channel = (hex: string, offset: number) => Number.parseInt(hex.slice(offset, offset + 2), 16);
  const value = [1, 3, 5].map((offset) => Math.round(lerp(channel(from, offset), channel(to, offset), progress)).toString(16).padStart(2, "0"));
  return `#${value.join("")}`;
}

export function projectKaiWorldExpression(moment: KaiKlokMoment): KaiWorldExpression {
  const current = TARGETS[moment.arkIndex] ?? TARGETS[0];
  const next = TARGETS[(moment.arkIndex + 1) % TARGETS.length] ?? TARGETS[0];
  const progress = smooth(moment.arkProgress);
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
    sky: {
      tint: mixHex(current.sky, next.sky, progress),
      luminance: lerp(current.luminance, next.luminance, progress),
      fogDensity: lerp(current.fog, next.fog, progress)
    },
    lighting: {
      hemisphere: lerp(current.hemisphere, next.hemisphere, progress),
      fill: lerp(current.fill, next.fill, progress),
      shadow: lerp(current.shadow, next.shadow, progress)
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
