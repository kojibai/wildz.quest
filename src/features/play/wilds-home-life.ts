/** Home suggestions project admitted structures and owned companions; they grant no resources. */
export type WildsHomeAction = "rest" | "craft" | "storage" | "invite";
export type WildsHomeResident = Readonly<{ id: string; name: string }>;
export type WildsHomeStructure = Readonly<{ structureId: string; blueprint: string; position: { x: number; z: number } }>;
export type WildsHomeLife = Readonly<{
  title: string;
  routine: string;
  companion?: WildsHomeResident;
  activities: readonly Readonly<{ action: WildsHomeAction; label: string; reason: string; structureId: string }>[];
}>;

export function projectWildsHomeLife(input: {
  structures: readonly WildsHomeStructure[];
  companions: readonly WildsHomeResident[];
  activeCompanionId?: string;
  preferredHomeId?: string;
  now: number;
}): WildsHomeLife | null {
  const shelters = [...input.structures].filter(s => s.blueprint === "trail-shelter").sort((a,b) => a.structureId.localeCompare(b.structureId));
  const shelter = shelters.find(s => s.structureId === input.preferredHomeId) ?? shelters[0];
  if (!shelter) return null;
  // Nearby buildings form a home; a distant workbench must not be advertised as part of it.
  const nearby = input.structures.filter(s => Math.hypot(s.position.x-shelter.position.x, s.position.z-shelter.position.z) <= 24);
  const bench = nearby.find(s => s.blueprint === "steward-workbench");
  const cache = nearby.find(s => s.blueprint === "trail-cache");
  const residents = [...new Map(input.companions.map(c => [c.id,c])).values()].sort((a,b) => a.id.localeCompare(b.id));
  const guests = residents.filter(c => c.id !== input.activeCompanionId);
  const day = Math.floor(Math.max(0, Number.isFinite(input.now) ? input.now : 0) / 86_400_000);
  const companion = guests.length ? guests[day % guests.length] : residents[0];
  const phase = day % 3;
  const routine = phase === 0 ? "Recover together, then choose a fresh trail." : phase === 1 && bench
    ? "Prepare your tools together before the next expedition." : cache ? "Put away your gathered materials and make room for another discovery." : "Return from the trail and take a quiet moment together.";
  const activities: WildsHomeLife["activities"][number][] = [{ action: "rest", label: "Rest together", reason: "Recover beside your shelter.", structureId: shelter.structureId }];
  if (bench) activities.push({ action: "craft", label: "Prepare tools", reason: "Use your nearby workbench.", structureId: bench.structureId });
  if (cache) activities.push({ action: "storage", label: "Store materials", reason: "Manage the supplies in your nearby cache.", structureId: cache.structureId });
  if (companion && companion.id !== input.activeCompanionId) activities.push({ action: "invite", label: `Spend time with ${companion.name}`, reason: "Choose this companion for your next journey.", structureId: shelter.structureId });
  return { title: "Life at your shelter", routine, companion, activities };
}
