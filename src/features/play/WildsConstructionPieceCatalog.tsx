"use client";
import { wildsConstructionLabel } from "./wilds-continuous-builder";
import type { WildsConstructionKind } from "./wilds-world-construction";
export const WILDS_BUILD_PIECE_GROUPS: ReadonlyArray<{ label: string; kinds: readonly WildsConstructionKind[] }> = [
  { label: "Structure", kinds: ["foundation", "floor", "room", "wall", "roof", "door", "window", "column", "stair", "bridge", "platform", "path"] },
  { label: "Living", kinds: ["storage", "workshop", "habitat", "bed", "hearth", "light", "garden", "water"] },
  { label: "Finishing", kinds: ["trim", "railing", "partition"] }
];
export function WildsConstructionPieceCatalog({ onSelect, selected }: { onSelect: (kind: WildsConstructionKind) => void; selected?: WildsConstructionKind }) {
  return <div className="wilds-builder-palette wilds-construction-piece-catalog" aria-label="Building pieces">
    {WILDS_BUILD_PIECE_GROUPS.map(group => <section key={group.label} aria-label={`${group.label} pieces`}><h3>{group.label}</h3><div>{group.kinds.map(kind => <button key={kind} type="button" aria-pressed={selected === kind} onClick={() => onSelect(kind)}>{wildsConstructionLabel(kind)}</button>)}</div></section>)}
  </div>;
}
