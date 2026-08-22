"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  createWildsQualityGovernor,
  readWildsLearnedQualityTier,
  writeWildsLearnedQualityTier,
  writeWildsQualityGovernor,
  type WildsQualityGovernorState
} from "./wilds-quality-governor";
import {
  selectWildsQualityProfile,
  wildsQualityProfileForTier,
  type WildsQualityProfile
} from "./wilds-quality-profile";

function deviceProfile(reducedMotion: boolean) {
  if (typeof window === "undefined") return selectWildsQualityProfile({ width: 390, reducedMotion });
  return selectWildsQualityProfile({
    width: window.innerWidth,
    hardwareConcurrency: navigator.hardwareConcurrency,
    deviceMemory: (navigator as Navigator & { deviceMemory?: number }).deviceMemory,
    reducedMotion
  });
}

function qualityStorage(): Storage | null {
  if (typeof window === "undefined") return null;
  try {
    return window.sessionStorage;
  } catch {
    return null;
  }
}

export function useWildsQualityProfile(): {
  profile: WildsQualityProfile;
  reportFrameSample: (frameMs: number) => void;
  reducedMotion: boolean;
} {
  const [initial] = useState(() => {
    const reducedMotion = typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const baseTier = deviceProfile(reducedMotion).tier;
    return { reducedMotion, baseTier, tier: readWildsLearnedQualityTier(qualityStorage(), baseTier) };
  });
  const [reducedMotion, setReducedMotion] = useState(initial.reducedMotion);
  const governorRef = useRef<WildsQualityGovernorState | null>(null);
  if (!governorRef.current) governorRef.current = createWildsQualityGovernor(initial.baseTier, initial.tier);
  const [tier, setTier] = useState(initial.tier);

  useEffect(() => {
    const motion = window.matchMedia("(prefers-reduced-motion: reduce)");
    let frame = 0;
    const recompute = () => {
      window.cancelAnimationFrame(frame);
      frame = window.requestAnimationFrame(() => {
        const reduced = motion.matches;
        const base = deviceProfile(reduced);
        const learnedTier = readWildsLearnedQualityTier(qualityStorage(), base.tier);
        setReducedMotion(reduced);
        governorRef.current = createWildsQualityGovernor(base.tier, learnedTier);
        setTier(learnedTier);
      });
    };
    window.addEventListener("resize", recompute);
    window.addEventListener("orientationchange", recompute);
    motion.addEventListener?.("change", recompute);
    return () => {
      window.cancelAnimationFrame(frame);
      window.removeEventListener("resize", recompute);
      window.removeEventListener("orientationchange", recompute);
      motion.removeEventListener?.("change", recompute);
    };
  }, []);

  const reportFrameSample = useCallback((frameMs: number) => {
    const current = governorRef.current;
    if (!current) return;
    const previousTier = current.tier;
    writeWildsQualityGovernor(
      current,
      frameMs,
      typeof document === "undefined" || document.visibilityState === "visible",
      typeof performance === "undefined" ? undefined : performance.now()
    );
    if (current.tier !== previousTier) {
      writeWildsLearnedQualityTier(qualityStorage(), current.tier);
      setTier(current.tier);
    }
  }, []);

  const profile = useMemo(() => wildsQualityProfileForTier(tier, reducedMotion), [reducedMotion, tier]);
  return { profile, reportFrameSample, reducedMotion };
}
