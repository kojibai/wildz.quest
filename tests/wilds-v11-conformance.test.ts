import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { readFileSync } from "node:fs";
import { publicRarityTableV11 } from "../src/features/play/wilds-v11-conformance";
import { verifyEncounterResultV11, type WildsV11EncounterResult } from "../src/features/play/wilds-encounter-proof-v11";
import { WILDS_V11_ENCOUNTER_PUBLIC_KEYS } from "../src/features/play/wilds-v11-release-keys";
import { WILDS_V11_CONFORMANCE_PUBLIC_KEYS } from "../src/features/play/wilds-v11-conformance-keys";

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

  it("replays examples under the separate conformance key and rejects them under the release key", async () => {
    for (const name of ["origin", "wilds", "deep-wilds", "frontier", "rare", "mythic", "eternal"]) {
      const result = JSON.parse(readFileSync(`public/conformance/v11/${name}.json`, "utf8")) as WildsV11EncounterResult;
      assert.equal(await verifyEncounterResultV11(result, WILDS_V11_CONFORMANCE_PUBLIC_KEYS), true, name);
      assert.equal(await verifyEncounterResultV11(result, WILDS_V11_ENCOUNTER_PUBLIC_KEYS), false, `${name} cannot be admitted`);
      if (["rare", "mythic", "eternal"].includes(name)) assert.equal(result.className, name);
      assert.equal(await verifyEncounterResultV11({ ...result, draw: (result.draw + 1) % 10_000_000 }, WILDS_V11_CONFORMANCE_PUBLIC_KEYS), false);
    }
  });
});
