type Position = Readonly<{ x: number; z: number }>;

/** Keep the first candidate on equal distance, matching a stable distance sort. */
export function nearestWildsVisible<T extends { position: Position }>(
  candidates: readonly T[],
  player: Position,
  radius: number | ((candidate: T) => number),
  compareEqualDistance?: (left: T, right: T) => number
): { candidate: T; distance: number } | null {
  let nearest: { candidate: T; distance: number } | null = null;
  for (const candidate of candidates) {
    const distance = Math.hypot(candidate.position.x - player.x, candidate.position.z - player.z);
    const limit = typeof radius === "number" ? radius : radius(candidate);
    if (!(distance <= limit)) continue;
    if (!nearest || distance < nearest.distance
      || (distance === nearest.distance && compareEqualDistance !== undefined && compareEqualDistance(candidate, nearest.candidate) < 0)) {
      nearest = { candidate, distance };
    }
  }
  return nearest;
}
