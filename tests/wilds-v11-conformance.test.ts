import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { publicRarityTableV11 } from "../src/features/play/wilds-v11-conformance";

describe("published v11 rarity law", () => {
  it("derives every class and band from one exact ten-million-outcome law", () => {
    const rows = publicRarityTableV11();
    assert.equal(rows.length, 20);
    for (const band of ["origin", "wilds", "deep-wilds", "frontier"]) {
      const bandRows = rows.filter(row => row.band === band);
      assert.equal(bandRows.length, 5);
      assert.equal(bandRows.reduce((total, row) => total + row.count, 0), 10_000_000);
      for (const row of bandRows) {
        assert.equal(row.exactProbability, `${row.numerator}/${row.denominator}`);
        assert.ok(Number.isFinite(row.scarcityBits));
      }
    }
    for (const [name, denominator] of [["rare", 1_000], ["mythic", 100_000], ["eternal", 1_000_000]] as const) {
      const row = rows.find(candidate => candidate.band === "frontier" && candidate.className === name);
      assert.equal(row?.exactProbability, `1/${denominator}`);
    }
    assert.equal(rows.find(row => row.band === "origin" && row.className === "eternal")?.exactProbability, "1/10000000");
  });
});
