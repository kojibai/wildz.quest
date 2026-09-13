"use client";
import { useEffect, useMemo, useState } from "react";
import { projectWildsCrewMap, type WildsCrewMapSource } from "./wilds-crew-map";

/** Sample the mutable physical bridge locally; movement does not rerender the game. */
export function useWildsCrewMap(source: WildsCrewMapSource | undefined, active: boolean) {
  const [revision, refresh] = useState(0);
  useEffect(() => {
    if (!active || !source) return;
    const timer = window.setInterval(() => refresh(value => value + 1), 500);
    return () => window.clearInterval(timer);
  }, [active, source]);
  // The timer revision invalidates a snapshot of the mutable physical runtime.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  return useMemo(() => projectWildsCrewMap(source), [source, revision]);
}
