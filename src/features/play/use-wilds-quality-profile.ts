"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createWildsQualityGovernor, updateWildsQualityGovernor } from "./wilds-quality-governor";
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

export function useWildsQualityProfile(): {
  profile: WildsQualityProfile;
  reportFrameSample: (frameMs: number) => void;
  reducedMotion: boolean;
} {
  const initialReducedMotion = typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const [reducedMotion, setReducedMotion] = useState(initialReducedMotion);
  const initialProfile = deviceProfile(initialReducedMotion);
  const governorRef = useRef(createWildsQualityGovernor(initialProfile.tier));
  const [tier, setTier] = useState(initialProfile.tier);

  useEffect(() => {
    const motion = window.matchMedia("(prefers-reduced-motion: reduce)");
    let frame = 0;
    const recompute = () => {
      window.cancelAnimationFrame(frame);
      frame = window.requestAnimationFrame(() => {
        const reduced = motion.matches;
        const base = deviceProfile(reduced);
        setReducedMotion(reduced);
        governorRef.current = createWildsQualityGovernor(base.tier);
        setTier(base.tier);
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
    const next = updateWildsQualityGovernor(current, {
      frameMs,
      visible: typeof document === "undefined" || document.visibilityState === "visible",
      atMs: typeof performance === "undefined" ? undefined : performance.now()
    });
    governorRef.current = next;
    if (next.tier !== current.tier) setTier(next.tier);
  }, []);

  const profile = useMemo(() => wildsQualityProfileForTier(tier, reducedMotion), [reducedMotion, tier]);
  return { profile, reportFrameSample, reducedMotion };
}
