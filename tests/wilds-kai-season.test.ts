import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { projectWildsKaiSeason } from "../src/features/play/wilds-kai-season";

describe("Kai seasonal projection", () => {
  it("projects the exact first and last days of the Kai year", () => {
    assert.deepEqual(projectWildsKaiSeason({ month: 1, day: 1 }), {
      season: "spring",
      seasonIndex: 0,
      dayOfSeason: 1,
      daysInSeason: 84,
      progress: 0
    });

    assert.deepEqual(projectWildsKaiSeason({ month: 8, day: 42 }), {
      season: "winter",
      seasonIndex: 3,
      dayOfSeason: 84,
      daysInSeason: 84,
      progress: 1
    });
  });

  it("moves seasons only at exact two-month boundaries", () => {
    assert.equal(projectWildsKaiSeason({ month: 2, day: 42 }).season, "spring");
    assert.equal(projectWildsKaiSeason({ month: 3, day: 1 }).season, "summer");
    assert.equal(projectWildsKaiSeason({ month: 5, day: 1 }).season, "autumn");
    assert.equal(projectWildsKaiSeason({ month: 7, day: 1 }).season, "winter");
  });

  it("fails closed for non-canonical Kai calendar coordinates", () => {
    for (const input of [
      { month: 0, day: 1 },
      { month: 9, day: 1 },
      { month: 1, day: 0 },
      { month: 1, day: 43 },
      { month: 1.5, day: 1 }
    ]) assert.throws(() => projectWildsKaiSeason(input), /kai_calendar_invalid/);
  });
});
