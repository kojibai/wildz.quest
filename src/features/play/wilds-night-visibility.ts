import type { KaiWorldExpression } from "./kai-moment-expression";

export type WildsNightVisibility = "cinematic" | "balanced" | "high";

export type WildsVisualSettings = Readonly<{
  lanternEnabled: boolean;
  nightVisibility: WildsNightVisibility;
}>;

export const DEFAULT_WILDS_VISUAL_SETTINGS: WildsVisualSettings = Object.freeze({
  lanternEnabled: true,
  nightVisibility: "balanced"
});

export function normalizeWildsVisualSettings(value: unknown): WildsVisualSettings {
  if (!value || typeof value !== "object" || Array.isArray(value)) return { ...DEFAULT_WILDS_VISUAL_SETTINGS };
  const settings = value as Record<string, unknown>;
  const lanternEnabled = typeof settings.lanternEnabled === "boolean"
    ? settings.lanternEnabled
    : DEFAULT_WILDS_VISUAL_SETTINGS.lanternEnabled;
  const nightVisibility = settings.nightVisibility === "cinematic"
    || settings.nightVisibility === "balanced"
    || settings.nightVisibility === "high"
    ? settings.nightVisibility
    : DEFAULT_WILDS_VISUAL_SETTINGS.nightVisibility;
  return { lanternEnabled, nightVisibility };
}

export type WildsNightRig = Readonly<{
  characterFill: number;
  rim: number;
  lanternIntensity: number;
  lanternVisible: boolean;
}>;

export type WildsDarknessContext = Readonly<{
  /** Authored cave, storm, canopy, or interior darkness independent of Kai night. */
  authoredDarkness: number;
  /** Ranked normalizes readability so local preferences cannot create advantage. */
  mode: "adventure" | "ranked";
}>;

const PRESETS: Readonly<Record<WildsNightVisibility, { fill: number; rim: number; lantern: number }>> = {
  cinematic: { fill: 0.08, rim: 0.82, lantern: 3.2 },
  balanced: { fill: 0.15, rim: 1, lantern: 4.8 },
  high: { fill: 0.26, rim: 1.32, lantern: 7.2 }
};

export function projectWildsNightRig(
  expression: KaiWorldExpression,
  settings: WildsVisualSettings,
  context: Partial<WildsDarknessContext> = {}
): WildsNightRig {
  const effectiveSettings = context.mode === "ranked"
    ? { ...settings, nightVisibility: "balanced" as const }
    : settings;
  const preset = PRESETS[effectiveSettings.nightVisibility];
  const authoredDarkness = Number.isFinite(context.authoredDarkness)
    ? Math.max(0, Math.min(1, context.authoredDarkness ?? 0))
    : 0;
  const night = Math.max(expression.night.amount, authoredDarkness);
  const lanternIntensity = effectiveSettings.lanternEnabled ? night * preset.lantern : 0;
  return {
    characterFill: expression.lighting.fill + night * preset.fill,
    rim: expression.lighting.rim * (1 + night * (preset.rim - 1)),
    lanternIntensity,
    lanternVisible: lanternIntensity > 0.02
  };
}
