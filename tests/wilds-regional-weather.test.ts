import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";

import {
  deriveKaiKlokMomentFromUPulse,
  KAI_N_DAY_MICRO
} from "../src/features/play/kai-klok-moment";
import {
  WILDS_WEATHER_BUCKET_UPULSES,
  projectWildsRegionalWeather
} from "../src/features/play/wilds-regional-weather";

const ecologyHead = "a".repeat(64);
const momentAtDay = (day: number, offset = 0) => deriveKaiKlokMomentFromUPulse({
  uPulse: Number(KAI_N_DAY_MICRO) * day + offset,
  authority: "world"
});

describe("deterministic regional weather", () => {
  it("projects the same frozen weather for the same exact authority inputs", () => {
    const input = {
      moment: momentAtDay(0),
      region: { x: 4, z: -7 },
      biome: "grove" as const,
      elevation: 0.3,
      waterProximity: 0.4,
      ecologyHead
    };
    const first = projectWildsRegionalWeather(input);
    const second = projectWildsRegionalWeather(structuredClone(input));

    assert.deepEqual(second, first);
    assert.equal(JSON.stringify(second), JSON.stringify(first));
    assert.equal(Object.isFrozen(first), true);
    assert.equal(Object.isFrozen(first.wind), true);
  });

  it("expresses mountain snow and coastal rain at the same Kai moment", () => {
    const moment = momentAtDay(294);
    const mountain = projectWildsRegionalWeather({
      moment,
      region: { x: 8, z: 2 },
      biome: "mountain",
      elevation: 0.94,
      waterProximity: 0.2,
      ecologyHead
    });
    const coast = projectWildsRegionalWeather({
      moment,
      region: { x: 2, z: 8 },
      biome: "coast",
      elevation: 0.03,
      waterProximity: 0.98,
      ecologyHead
    });

    assert.equal(mountain.precipitation.kind, "snow");
    assert.equal(coast.precipitation.kind, "rain");
    assert.ok(mountain.temperature < coast.temperature);
  });

  it("lets biome and season materially alter ecological expression", () => {
    const base = { region: { x: 1, z: 1 }, elevation: 0.12, waterProximity: 0.5, ecologyHead };
    const springGrove = projectWildsRegionalWeather({ ...base, moment: momentAtDay(0), biome: "grove" });
    const winterStone = projectWildsRegionalWeather({ ...base, moment: momentAtDay(294), biome: "stone" });

    assert.equal(springGrove.season, "spring");
    assert.equal(winterStone.season, "winter");
    assert.ok(springGrove.pollinationMultiplier > winterStone.pollinationMultiplier);
    assert.notEqual(springGrove.temperatureBand, winterStone.temperatureBand);
  });

  it("changes only when its exact Kai weather bucket changes", () => {
    const base = { region: { x: 0, z: 0 }, biome: "grove" as const, elevation: 0.2, waterProximity: 0.3, ecologyHead };
    const first = projectWildsRegionalWeather({ ...base, moment: momentAtDay(0, 10) });
    const sameBucket = projectWildsRegionalWeather({ ...base, moment: momentAtDay(0, 20) });
    const nextBucket = projectWildsRegionalWeather({ ...base, moment: momentAtDay(0, WILDS_WEATHER_BUCKET_UPULSES + 10) });

    assert.equal(sameBucket.cellDigest, first.cellDigest);
    assert.deepEqual(sameBucket.precipitation, first.precipitation);
    assert.notEqual(nextBucket.cellDigest, first.cellDigest);
    assert.equal(first.nextChangeUPulse, WILDS_WEATHER_BUCKET_UPULSES);
  });

  it("contains no ambient clock, network, timer, or mutable-random dependency", () => {
    const source = readFileSync("src/features/play/wilds-regional-weather.ts", "utf8");
    assert.doesNotMatch(source, /Date\.now|fetch\s*\(|setTimeout|setInterval|Math\.random/);
  });
});
