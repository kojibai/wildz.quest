export type WildsQualityTier = "low" | "medium" | "high";

export type WildsQualityProfile = {
  tier: WildsQualityTier;
  dpr: 1 | 1.25 | 1.5;
  shadowMapSize: 512 | 1024;
  foliage: number;
  particles: number;
  maxDrawCalls: 160;
  maxTriangles: 180_000;
};

export function selectWildsQualityProfile(input: {
  width: number;
  hardwareConcurrency?: number;
  deviceMemory?: number;
  reducedMotion: boolean;
}): WildsQualityProfile {
  const cores = input.hardwareConcurrency ?? 4;
  const memory = input.deviceMemory ?? 4;
  const tier: WildsQualityTier = input.width <= 380 || cores <= 2 || memory <= 2
    ? "low"
    : input.width < 900 || cores < 8 || memory < 8
      ? "medium"
      : "high";
  const base = tier === "low"
    ? { dpr: 1 as const, shadowMapSize: 512 as const, foliage: 0.58, particles: 0.55 }
    : tier === "medium"
      ? { dpr: 1.25 as const, shadowMapSize: 1024 as const, foliage: 0.8, particles: 0.78 }
      : { dpr: 1.5 as const, shadowMapSize: 1024 as const, foliage: 1, particles: 1 };

  return {
    ...base,
    tier,
    particles: input.reducedMotion ? 0.35 : base.particles,
    maxDrawCalls: 160,
    maxTriangles: 180_000
  };
}

export function rendererBudgetStatus(
  profile: WildsQualityProfile,
  render: { calls: number; triangles: number }
) {
  const drawCallRatio = render.calls / profile.maxDrawCalls;
  const triangleRatio = render.triangles / profile.maxTriangles;
  return {
    withinBudget: drawCallRatio <= 1 && triangleRatio <= 1,
    drawCallRatio,
    triangleRatio
  };
}
