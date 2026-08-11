"use client";

import { createContext, useContext, type ReactNode } from "react";
import type { WildsReadabilityProfile } from "./wilds-night-readability";

const DAYLIGHT_READABILITY: WildsReadabilityProfile = Object.freeze({
  darkness: 0,
  actorEmissive: 0,
  pathEmissive: 0,
  threatEmissive: 0,
  motionScale: 1
});

const WildsReadabilityContext = createContext<WildsReadabilityProfile>(DAYLIGHT_READABILITY);

export function WildsReadabilityProvider({ children, value }: { children: ReactNode; value: WildsReadabilityProfile }) {
  return <WildsReadabilityContext.Provider value={value}>{children}</WildsReadabilityContext.Provider>;
}

export function useWildsReadability() {
  return useContext(WildsReadabilityContext);
}
