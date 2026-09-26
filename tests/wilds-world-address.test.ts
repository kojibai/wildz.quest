import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  offsetWildsWorldAddress,
  parseWildsWorldAddress,
  v10PositionToWildsAddress,
  wildsAddressDistanceSquared
} from "../src/features/play/wilds-world-address";

const origin = { worldVersion: 11, regionX: "0", regionZ: "0", localX: 0, localZ: 0 } as const;

describe("v11 Wilds world addresses", () => {
  it("accepts canonical signed regions and bounded integer micro-units", () => {
    assert.deepEqual(parseWildsWorldAddress(origin), origin);
    assert.deepEqual(parseWildsWorldAddress({
      worldVersion: 11, regionX: "-2", regionZ: "9007199254740993", localX: 23_999_999, localZ: 7
    }), { worldVersion: 11, regionX: "-2", regionZ: "9007199254740993", localX: 23_999_999, localZ: 7 });
  });

  it("rejects ambiguous strings and non-integral or out-of-region offsets", () => {
    for (const regionX of ["00", "-0", "+1", "1.0", " 1", "1 ", "01", 1]) {
      assert.throws(() => parseWildsWorldAddress({ ...origin, regionX }), /address|region/i);
    }
    for (const localX of [-1, 0.5, 24_000_000, Number.NaN, Number.POSITIVE_INFINITY]) {
      assert.throws(() => parseWildsWorldAddress({ ...origin, localX }), /address|local/i);
    }
    assert.throws(() => parseWildsWorldAddress({ ...origin, worldVersion: 10 }), /address|version/i);
  });

  it("normalizes positive and negative boundary crossings exactly", () => {
    assert.deepEqual(offsetWildsWorldAddress({ ...origin, localX: 23_999_999 }, 1n, 0n), {
      ...origin, regionX: "1", localX: 0
    });
    assert.deepEqual(offsetWildsWorldAddress({ ...origin, regionX: "-1" }, -1n, -1n), {
      ...origin, regionX: "-2", regionZ: "-1", localX: 23_999_999, localZ: 23_999_999
    });
    assert.deepEqual(offsetWildsWorldAddress(origin, 24_000_001n, -24_000_001n), {
      ...origin, regionX: "1", regionZ: "-2", localX: 1, localZ: 23_999_999
    });
  });

  it("converts exactly representable v10 positions without changing their location", () => {
    assert.deepEqual(v10PositionToWildsAddress(-0.000001, 24.5), {
      ...origin, regionX: "-1", regionZ: "1", localX: 23_999_999, localZ: 500_000
    });
    assert.deepEqual(v10PositionToWildsAddress(500_000_000, -500_000_000), {
      ...origin, regionX: "20833333", regionZ: "-20833334", localX: 8_000_000, localZ: 16_000_000
    });
    for (const position of [0.0000001, Number.POSITIVE_INFINITY, Number.NaN]) {
      assert.throws(() => v10PositionToWildsAddress(position, 0), /position|micro|finite/i);
    }
  });

  it("computes distance with BigInt beyond Number's exact integer range", () => {
    assert.equal(wildsAddressDistanceSquared({ ...origin, regionX: "9007199254740993", regionZ: "-1" }),
      9007199254740993n ** 2n + 1n);
  });
});
