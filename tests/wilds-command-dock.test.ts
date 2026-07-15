import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { describe, it } from "node:test";

describe("Wilds command dock", () => {
  it("exposes one accessible dismissible sheet for four icon commands", async () => {
    const source = await readFile("src/features/play/WildsCommandDock.tsx", "utf8");

    assert.match(source, /"mission" \| "rewards" \| "deck" \| "vault"/);
    assert.match(source, /role="dialog"/);
    assert.match(source, /aria-modal="true"/);
    assert.match(source, /aria-controls=/);
    assert.match(source, /aria-pressed=/);
    assert.match(source, /event\.key === "Escape"/);
    assert.match(source, /\.focus\(\)/);
    assert.match(source, /wilds-command-backdrop/);
    assert.match(source, /onPointerCancel=/);
    assert.match(source, /onLostPointerCapture=/);
    assert.match(source, /setPointerCapture/);
    assert.match(source, /72/);
  });

  it("renders tasteful fixed-position values inside command icons", async () => {
    const source = await readFile("src/features/play/WildsCommandDock.tsx", "utf8");

    assert.match(source, /wilds-command-badge/);
    assert.match(source, /item\.badge/);
    assert.match(source, /aria-hidden="true"/);
  });
});
