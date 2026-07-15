"use client";

import { useEffect, useState } from "react";
import { proofEventTimestampLabel } from "@/lib/proof-events/time";
import type { ProofEvent } from "@/types/domain";

export function ProofEventAge({ event }: { event: ProofEvent }) {
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    const interval = window.setInterval(() => setNow(new Date()), 30_000);
    return () => window.clearInterval(interval);
  }, []);

  return <small suppressHydrationWarning>{proofEventTimestampLabel(event, now)}</small>;
}
