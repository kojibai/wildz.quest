import { canonicalPortableCardJson } from "./portable-card";
import type { WildsWorldProjection } from "./wilds-world-state";

const keys = ["sites", "bosses", "structures", "burrows", "constructionComponents", "constructionMaterialContributions", "constructionWorkContributions"] as const;
type Geometry = Pick<WildsWorldProjection, typeof keys[number]>;

/** Worker snapshots clone every record. Preserve geometry references when only
 * harvest, inventory, or settlement data changes, using exact data comparison. */
export function createWildsWorldGeometrySelector() {
  let previous: Geometry | null = null;
  let signatures = new Map<string, string>();
  return (world: WildsWorldProjection | null): Geometry | null => {
    if (!world) { previous = null; signatures.clear(); return null; }
    const nextSignatures = new Map(keys.map(key => [key, canonicalPortableCardJson(world[key] ?? null)]));
    if (previous && keys.every(key => signatures.get(key) === nextSignatures.get(key))) return previous;
    const next = Object.fromEntries(keys.map(key => [key,
      previous && signatures.get(key) === nextSignatures.get(key) ? previous[key] : world[key]
    ])) as Geometry;
    previous = next;
    signatures = nextSignatures;
    return next;
  };
}
