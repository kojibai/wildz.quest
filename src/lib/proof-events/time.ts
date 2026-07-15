import type { ProofEvent } from "@/types/domain";

const MINUTE_MS = 60_000;
const HOUR_MS = 60 * MINUTE_MS;
const DAY_MS = 24 * HOUR_MS;

function plural(value: number, unit: string) {
  return `${value}${unit} ago`;
}

export function proofEventTimestampLabel(event: ProofEvent, now = new Date()) {
  if (!event.createdAt) return event.timestampLabel;

  const createdAt = Date.parse(event.createdAt);
  const nowValue = now.getTime();
  if (!Number.isFinite(createdAt) || !Number.isFinite(nowValue)) return event.timestampLabel;

  const age = Math.max(0, nowValue - createdAt);
  if (age < MINUTE_MS) return "now";
  if (age < HOUR_MS) return plural(Math.floor(age / MINUTE_MS), "m");
  if (age < DAY_MS) return plural(Math.floor(age / HOUR_MS), "h");
  return plural(Math.floor(age / DAY_MS), "d");
}
