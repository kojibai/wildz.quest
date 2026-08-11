export type CompanionCarouselCard = {
  id: string;
  eligible?: boolean;
};

export type CompanionCarouselProjection = {
  activeId: string | null;
  previousId: string | null;
  nextId: string | null;
  position: number;
  total: number;
};

function eligibleIds(cards: readonly CompanionCarouselCard[]) {
  const seen = new Set<string>();
  const ids: string[] = [];
  for (const card of cards) {
    if (!card.id || card.eligible === false || seen.has(card.id)) continue;
    seen.add(card.id);
    ids.push(card.id);
  }
  return ids;
}

export function companionCarousel(
  cards: readonly CompanionCarouselCard[],
  activeId: string | null
): CompanionCarouselProjection {
  const ids = eligibleIds(cards);
  if (ids.length === 0) {
    return { activeId: null, previousId: null, nextId: null, position: 0, total: 0 };
  }
  const activeIndex = Math.max(0, ids.indexOf(activeId ?? ""));
  return {
    activeId: ids[activeIndex]!,
    previousId: ids.length === 1 ? null : ids[(activeIndex - 1 + ids.length) % ids.length]!,
    nextId: ids.length === 1 ? null : ids[(activeIndex + 1) % ids.length]!,
    position: activeIndex + 1,
    total: ids.length
  };
}

export function cycleCompanion(
  cards: readonly CompanionCarouselCard[],
  activeId: string | null,
  direction: -1 | 1
): string | null {
  const ids = eligibleIds(cards);
  if (ids.length === 0) return null;
  const activeIndex = ids.indexOf(activeId ?? "");
  const origin = activeIndex >= 0 ? activeIndex : 0;
  return ids[(origin + direction + ids.length) % ids.length]!;
}

export function cycleVaultCompanion(
  rosterIds: readonly string[],
  activeId: string | null,
  direction: -1 | 1
): string | null {
  return cycleCompanion(rosterIds.map((id) => ({ id })), activeId, direction);
}
