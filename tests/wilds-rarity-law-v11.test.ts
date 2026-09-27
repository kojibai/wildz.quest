import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  deriveUniformRarityDraw,
  rarityBand,
  rarityBandCounts,
  rarityClass,
  rarityOdds,
  reduceUnbiasedRarity64,
  WILDS_RARITY_DRAW_DENOMINATOR_V11
} from "../src/features/play/wilds-rarity-law-v11.js";
import type { WildsWorldAddress } from "../src/features/play/wilds-world-address.js";

const address = (regionX: string, regionZ = "0"): WildsWorldAddress =>
  ({ worldVersion: 11, regionX, regionZ, localX: 0, localZ: 0 });

describe("v11 exact rarity law", () => {
  it("uses signed squared-region distance at every band boundary", () => {
    assert.equal(rarityBand(address("0")), "origin");
    assert.equal(rarityBand(address("24")), "origin");
    assert.equal(rarityBand(address("25")), "wilds");
    assert.equal(rarityBand(address("-25")), "wilds");
    assert.equal(rarityBand(address("124")), "wilds");
    assert.equal(rarityBand(address("125")), "deep-wilds");
    assert.equal(rarityBand(address("499")), "deep-wilds");
    assert.equal(rarityBand(address("500")), "frontier");
    assert.equal(rarityBand(address("300", "400")), "frontier");
    assert.equal(rarityBand(address("90071992547409931234567890")), "frontier");
  });

  it("publishes exhaustive, mutually exclusive integer counts and exact frontier odds", () => {
    const expected = {
      origin: { eternal: 1, mythic: 10, rare: 1_000, uncommon: 2_000_000, trail: 7_998_989 },
      wilds: { eternal: 2, mythic: 20, rare: 2_000, uncommon: 2_000_000, trail: 7_997_978 },
      "deep-wilds": { eternal: 5, mythic: 50, rare: 5_000, uncommon: 2_000_000, trail: 7_994_945 },
      frontier: { eternal: 10, mythic: 100, rare: 10_000, uncommon: 2_000_000, trail: 7_989_890 }
    } as const;
    for (const [band, counts] of Object.entries(expected) as [keyof typeof expected, typeof expected[keyof typeof expected]][]) {
      assert.deepEqual(rarityBandCounts(band), counts);
      assert.equal(Object.values(counts).reduce((sum, count) => sum + count, 0), WILDS_RARITY_DRAW_DENOMINATOR_V11);
      let lower = 0;
      for (const className of ["eternal", "mythic", "rare", "uncommon", "trail"] as const) {
        assert.equal(rarityClass(band, lower), className);
        assert.equal(rarityClass(band, lower + counts[className] - 1), className);
        lower += counts[className];
      }
      assert.equal(lower, WILDS_RARITY_DRAW_DENOMINATOR_V11);
    }
    assert.deepEqual(rarityOdds("frontier", "rare"), { numerator: 1n, denominator: 1_000n });
    assert.deepEqual(rarityOdds("frontier", "mythic"), { numerator: 1n, denominator: 100_000n });
    assert.deepEqual(rarityOdds("frontier", "eternal"), { numerator: 1n, denominator: 1_000_000n });
    assert.deepEqual(rarityOdds("origin", "eternal"), { numerator: 1n, denominator: 10_000_000n });
    assert.throws(() => rarityClass("origin", -1));
    assert.throws(() => rarityClass("origin", 10_000_000));
  });

  it("rejects biased 64-bit tails and derives a stable signed-proof draw", () => {
    const limit = (1n << 64n) / 10_000_000n * 10_000_000n;
    assert.equal(reduceUnbiasedRarity64(limit - 1n), Number((limit - 1n) % 10_000_000n));
    assert.equal(reduceUnbiasedRarity64(limit), null);
    assert.equal(reduceUnbiasedRarity64((1n << 64n) - 1n), null);
    assert.throws(() => reduceUnbiasedRarity64(-1n));
    const signature = new Uint8Array(64).map((_, index) => index);
    const draw = deriveUniformRarityDraw(signature);
    assert.ok(draw >= 0 && draw < 10_000_000);
    assert.equal(deriveUniformRarityDraw(signature), draw);
    assert.notEqual(deriveUniformRarityDraw(new Uint8Array(64).fill(1)), draw);
    assert.throws(() => deriveUniformRarityDraw(new Uint8Array(63)));
  });
});
