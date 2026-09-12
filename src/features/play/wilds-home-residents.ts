export function projectWildsHomeResidents<T extends { id: string }>(input: {
  candidates: readonly T[];
  ownedIds: readonly string[];
  excludedIds: readonly string[];
  shelterPosition: { x: number; z: number };
  player: { x: number; z: number };
  spaceId: string;
}): readonly T[] {
  const distance = Math.hypot(input.player.x-input.shelterPosition.x,input.player.z-input.shelterPosition.z);
  if (input.spaceId !== "wildz.space.outer.v1" || !Number.isFinite(distance) || distance > 30) return [];
  const owned = new Set(input.ownedIds);
  const excluded = new Set(input.excludedIds);
  return [...new Map(input.candidates.filter(card => owned.has(card.id) && !excluded.has(card.id)).map(card => [card.id,card])).values()]
    .sort((a,b) => a.id.localeCompare(b.id)).slice(0,2);
}
