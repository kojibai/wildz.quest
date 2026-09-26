"use client";

import { useState, type ReactNode } from "react";

/** Do not mount a lazy screen until requested. Retain it afterward so closing
 * and reopening preserves its local state and runs its normal close effects. */
export function WildsVisitedSurface({ active, children }: { active: boolean; children: ReactNode }) {
  const [visited, setVisited] = useState(active);
  if (active && !visited) setVisited(true);
  return active || visited ? children : null;
}
