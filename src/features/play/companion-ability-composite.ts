export type CompanionAbilityNavigationKey = "ArrowLeft" | "ArrowRight" | "ArrowUp" | "ArrowDown";

export function nextCompanionAbilityIndex(
  current: number,
  key: CompanionAbilityNavigationKey,
  count: number
) {
  const boundedCount = Math.max(1, Math.trunc(count));
  const direction = key === "ArrowRight" || key === "ArrowDown" ? 1 : -1;
  return (current + direction + boundedCount) % boundedCount;
}
