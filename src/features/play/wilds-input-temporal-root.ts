import type { WildsInput } from "./game-state";
import { kaiUPulseToISOString } from "./kai-klok-moment";

/**
 * Admits a local gameplay action onto the Kai axis. Conventional timestamps
 * remain in the legacy action shapes, but are projections of the exact root.
 */
export function rootWildsInputInKai<T extends WildsInput>(input: T, kaiUPulse: number): T & { kaiUPulse: number } {
  const at = kaiUPulseToISOString(kaiUPulse);
  const rooted = { ...input, kaiUPulse };
  let normalized: Record<string, unknown> = rooted;
  switch (input.type) {
    case "capture": normalized = { ...rooted, capturedAt: at }; break;
    case "search-point": normalized = { ...rooted, searchedAt: at }; break;
    case "fuse-cards": normalized = { ...rooted, fusedAt: at }; break;
    case "evolve": normalized = { ...rooted, evolvedAt: at }; break;
    case "use-field-ability": normalized = { ...rooted, usedAt: at }; break;
    case "mark-synced":
    case "mark-listed": normalized = { ...rooted, synchronizedAt: at }; break;
    case "advance-encounter":
    case "start-battle":
    case "ascend-card":
    case "train":
    case "rest": normalized = { ...rooted, at }; break;
    case "battle-action": normalized = { ...rooted, at }; break;
  }
  return normalized as unknown as T & { kaiUPulse: number };
}
