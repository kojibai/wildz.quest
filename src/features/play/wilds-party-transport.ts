/** Explicit party relocation generation. Walking never advances this marker. */
export function nextWildsPartyTravelRevision(value: number | undefined): number {
  return Number.isSafeInteger(value) && value! >= 0 && value! < Number.MAX_SAFE_INTEGER ? value! + 1 : 1;
}
