export type WildsFlightObstruction = Readonly<{ label: string; guidance: string }>;

export function projectWildsFlightObstruction(blockerId: string | null): WildsFlightObstruction | null {
  if (!blockerId) return null;
  if (blockerId.includes("trail-gate-beam")) return Object.freeze({ label: "Trail Gate beam overhead", guidance: "Move into open sky to keep climbing." });
  if (blockerId.startsWith("ceiling:") || blockerId.includes(":interior")) return Object.freeze({ label: "Cave roof overhead", guidance: "Descend or follow the chamber opening." });
  if (blockerId.includes(":tree:")) return Object.freeze({ label: "Tree canopy overhead", guidance: "Move into open sky to keep climbing." });
  if (blockerId.includes("living-boss")) return Object.freeze({ label: "A powerful creature controls this air", guidance: "Circle clear before climbing higher." });
  if (blockerId.includes("living-site") || blockerId.includes("timber-hall")) return Object.freeze({ label: "Structure overhead", guidance: "Move beyond its roofline to keep climbing." });
  return Object.freeze({ label: "Solid cover overhead", guidance: "Move into visible open sky to keep climbing." });
}
