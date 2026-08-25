import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { describe, it } from "node:test";

describe("Wilds command dock", () => {
  it("exposes one accessible dismissible sheet for every world command", async () => {
    const source = await readFile("src/features/play/WildsCommandDock.tsx", "utf8");

    assert.match(source, /"mission" \| "fieldGuide" \| "satchel" \| "construction" \| "deck" \| "vault"/);
    assert.match(source, /role="dialog"/);
    assert.match(source, /aria-modal="true"/);
    assert.match(source, /aria-controls=/);
    assert.match(source, /aria-pressed=/);
    assert.match(source, /event\.key === "Escape"/);
    assert.match(source, /\.focus\(\)/);
    assert.match(source, /wilds-command-backdrop/);
    assert.match(source, /onPointerCancel=/);
    assert.match(source, /createPortal\([\s\S]*wilds-command-overlay[\s\S]*document\.body/s);
    assert.match(source, /onPointerDown=\{\(event\) => event\.stopPropagation\(\)\}/);
    assert.match(source, /wilds-command-sheet-chrome[\s\S]*wilds-command-handle[\s\S]*setPointerCapture/s);
    assert.match(source, /dragDistanceRef\.current > 72[\s\S]*if \(shouldClose\) close\(\)/s);
    assert.doesNotMatch(source, /wilds-command-sheet-content[^>]+onPointer/);
  });

  it("renders tasteful fixed-position values inside command icons", async () => {
    const source = await readFile("src/features/play/WildsCommandDock.tsx", "utf8");

    assert.match(source, /wilds-command-badge/);
    assert.match(source, /item\.badge/);
    assert.match(source, /aria-hidden="true"/);
  });
});
