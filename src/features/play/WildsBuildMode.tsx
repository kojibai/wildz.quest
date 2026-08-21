import React from "react";
import type { WildsBlueprintPlacement, WildsBlueprintPreview, WildsConstructionKind } from "./wilds-world-construction";
import { WILDS_CONSTRUCTION_CATALOG } from "./wilds-world-construction";

// Unmounted preview surface. Live-game admission remains blocked by v122.

type Props = Readonly<{
  blueprint: WildsBlueprintPreview;
  selectedKind: WildsConstructionKind;
  placement: WildsBlueprintPlacement;
  onSelect(kind: WildsConstructionKind): void;
  onRotate(delta: number): void;
  onHeight(delta: number): void;
  onUndo(): void;
}>;

const CONTROL_STYLE = Object.freeze({ minWidth: 44, minHeight: 44 });

function title(kind: WildsConstructionKind) {
  return kind.charAt(0).toUpperCase() + kind.slice(1);
}

export function WildsBuildMode({ blueprint, selectedKind, placement, onSelect, onRotate, onHeight, onUndo }: Props) {
  return (
    <section aria-label="Shape this place" data-wilds-build-mode="preview">
      <header>
        <h2>Shape this place</h2>
        <p aria-live="polite">{placement.valid ? "This shape fits here." : placement.cues.join(" · ")}</p>
      </header>
      <div role="list" aria-label="Available shapes">
        {WILDS_CONSTRUCTION_CATALOG.map((entry) => (
          <div key={entry.kind} role="listitem">
            <button
              type="button"
              data-build-kind={entry.kind}
              aria-pressed={selectedKind === entry.kind}
              onClick={() => onSelect(entry.kind)}
              style={CONTROL_STYLE}
            >
              {title(entry.kind)}
            </button>
          </div>
        ))}
      </div>
      <div aria-label="Shape controls">
        <button type="button" aria-label="Rotate shape" onClick={() => onRotate(1)} style={CONTROL_STYLE}>↻</button>
        <button type="button" aria-label="Raise shape" onClick={() => onHeight(1)} style={CONTROL_STYLE}>↑</button>
        <button type="button" aria-label="Lower shape" onClick={() => onHeight(-1)} style={CONTROL_STYLE}>↓</button>
        <button type="button" aria-label="Undo last shape" disabled={blueprint.pieces.length === 0} onClick={onUndo} style={CONTROL_STYLE}>↶</button>
      </div>
    </section>
  );
}
