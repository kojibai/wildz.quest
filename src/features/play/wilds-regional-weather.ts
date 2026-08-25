import type { KaiKlokMoment } from "./kai-klok-moment";
import { projectWildsKaiSeason, type WildsSeason } from "./wilds-kai-season";

export const WILDS_WEATHER_BUCKET_UPULSES = 484_000_000 as const;

export type WildsRegionalBiome = "grove" | "meadow" | "forest" | "coast" | "wetland" | "mountain" | "stone";
export type WildsTemperatureBand = "frozen" | "cold" | "mild" | "warm" | "hot";
export type WildsPrecipitationKind = "none" | "rain" | "snow" | "mist" | "pollen";

export type WildsRegionalWeather = Readonly<{
  schema: "wildz.regional-weather.v1";
  cellDigest: string;
  bucket: number;
  season: WildsSeason;
  temperature: number;
  temperatureBand: WildsTemperatureBand;
  precipitation: Readonly<{ kind: WildsPrecipitationKind; intensity: number }>;
  wind: Readonly<{ x: number; z: number; strength: number }>;
  visibility: number;
  soilMoistureDelta: number;
  pollinationMultiplier: number;
  flightModifier: number;
  currentModifier: number;
  hazardCues: readonly string[];
  nextChangeUPulse: number;
}>;

type WeatherInput = Readonly<{
  moment: KaiKlokMoment;
  region: Readonly<{ x: number; z: number }>;
  biome: WildsRegionalBiome;
  elevation: number;
  waterProximity: number;
  ecologyHead: string;
}>;

const BIOMES = new Set<WildsRegionalBiome>(["grove", "meadow", "forest", "coast", "wetland", "mountain", "stone"]);

function clamp(value: number, min = 0, max = 1) {
  return Math.max(min, Math.min(max, value));
}

function rounded(value: number, precision = 1_000) {
  return Math.round(value * precision) / precision;
}

function hash32(value: string, salt = 0) {
  let hash = (0x811c9dc5 ^ salt) >>> 0;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  hash ^= hash >>> 16;
  hash = Math.imul(hash, 0x7feb352d) >>> 0;
  hash ^= hash >>> 15;
  return hash >>> 0;
}

function unit(seed: string, salt: number) {
  return hash32(seed, salt) / 0xffffffff;
}

function bandFor(temperature: number): WildsTemperatureBand {
  if (temperature < 0.18) return "frozen";
  if (temperature < 0.36) return "cold";
  if (temperature < 0.61) return "mild";
  if (temperature < 0.82) return "warm";
  return "hot";
}

function assertInput(input: WeatherInput) {
  if (!Number.isSafeInteger(input.moment.uPulse) || input.moment.uPulse < 0
    || !Number.isSafeInteger(input.region.x) || !Number.isSafeInteger(input.region.z)
    || Math.abs(input.region.x) > 1_000_000 || Math.abs(input.region.z) > 1_000_000
    || !BIOMES.has(input.biome)
    || !Number.isFinite(input.elevation) || input.elevation < 0 || input.elevation > 1
    || !Number.isFinite(input.waterProximity) || input.waterProximity < 0 || input.waterProximity > 1
    || !/^[a-f0-9]{64}$/i.test(input.ecologyHead)) {
    throw new Error("wilds_regional_weather_input_invalid");
  }
}

export function projectWildsRegionalWeather(input: WeatherInput): WildsRegionalWeather {
  assertInput(input);
  const seasonProjection = projectWildsKaiSeason(input.moment);
  const bucket = Math.floor(input.moment.uPulse / WILDS_WEATHER_BUCKET_UPULSES);
  const seed = [
    bucket,
    input.region.x,
    input.region.z,
    input.biome,
    Math.round(input.elevation * 1_000),
    Math.round(input.waterProximity * 1_000),
    input.ecologyHead,
    seasonProjection.season
  ].join(":");

  const seasonHeat = { spring: 0.56, summer: 0.77, autumn: 0.48, winter: 0.24 }[seasonProjection.season];
  const biomeHeat = { grove: 0, meadow: 0.04, forest: -0.04, coast: 0.06, wetland: -0.02, mountain: -0.12, stone: 0.08 }[input.biome];
  const temperature = rounded(clamp(seasonHeat + biomeHeat - input.elevation * 0.42 + (unit(seed, 11) - 0.5) * 0.12));
  const temperatureBand = bandFor(temperature);

  const moisture = clamp(input.waterProximity * 0.58
    + ({ grove: 0.16, meadow: 0.02, forest: 0.13, coast: 0.34, wetland: 0.38, mountain: -0.04, stone: -0.12 }[input.biome])
    + (seasonProjection.season === "winter" ? 0.1 : seasonProjection.season === "summer" ? -0.08 : 0)
    + (unit(seed, 23) - 0.5) * 0.22);

  let precipitationKind: WildsPrecipitationKind = "none";
  let precipitationIntensity = 0;
  if (input.biome === "mountain" && input.elevation >= 0.72 && temperature < 0.36) {
    precipitationKind = "snow";
    precipitationIntensity = 0.38 + moisture * 0.48;
  } else if (input.biome === "coast" && input.waterProximity >= 0.8) {
    precipitationKind = "rain";
    precipitationIntensity = 0.42 + moisture * 0.46;
  } else if (moisture > 0.68) {
    precipitationKind = temperature < 0.3 ? "snow" : "rain";
    precipitationIntensity = (moisture - 0.5) * 1.35;
  } else if ((input.biome === "wetland" || input.biome === "forest") && moisture > 0.48) {
    precipitationKind = "mist";
    precipitationIntensity = 0.2 + moisture * 0.34;
  } else if ((input.biome === "grove" || input.biome === "meadow")
    && seasonProjection.season === "spring" && unit(seed, 31) > 0.46) {
    precipitationKind = "pollen";
    precipitationIntensity = 0.2 + unit(seed, 37) * 0.34;
  }
  const precipitation = Object.freeze({
    kind: precipitationKind,
    intensity: rounded(clamp(precipitationIntensity))
  });

  const windAngle = unit(seed, 41) * Math.PI * 2;
  const windStrength = rounded(clamp(0.12 + unit(seed, 43) * 0.58 + input.elevation * 0.22));
  const wind = Object.freeze({
    x: rounded(Math.cos(windAngle) * windStrength),
    z: rounded(Math.sin(windAngle) * windStrength),
    strength: windStrength
  });
  const visibility = rounded(clamp(1 - precipitation.intensity * (precipitation.kind === "mist" ? 0.62 : 0.4) - windStrength * 0.08));
  const soilMoistureDelta = rounded(clamp(precipitation.intensity * 0.68 + moisture * 0.12 - temperature * 0.18, -1, 1));
  const seasonalPollination = { spring: 1.34, summer: 1.08, autumn: 0.72, winter: 0.28 }[seasonProjection.season];
  const pollinationMultiplier = rounded(clamp(
    seasonalPollination * ({ grove: 1.18, meadow: 1.24, forest: 0.92, coast: 0.72, wetland: 0.88, mountain: 0.42, stone: 0.3 }[input.biome])
      * (precipitation.kind === "snow" ? 0.3 : precipitation.kind === "rain" ? 0.78 : 1),
    0,
    2
  ));
  const flightModifier = rounded(clamp(1 - windStrength * 0.32 - precipitation.intensity * 0.24, 0.35, 1.15));
  const currentModifier = rounded(clamp(0.8 + input.waterProximity * 0.26 + windStrength * 0.18, 0.5, 1.4));
  const hazardCues: string[] = [];
  if (precipitation.kind === "snow") hazardCues.push("ice", "low-thermal-lift");
  if (precipitation.kind === "rain" && precipitation.intensity > 0.62) hazardCues.push("slick-ground", "rising-water");
  if (windStrength > 0.72) hazardCues.push("strong-crosswind");
  if (visibility < 0.62) hazardCues.push("low-visibility");

  return Object.freeze({
    schema: "wildz.regional-weather.v1",
    cellDigest: hash32(seed, 101).toString(16).padStart(8, "0"),
    bucket,
    season: seasonProjection.season,
    temperature,
    temperatureBand,
    precipitation,
    wind,
    visibility,
    soilMoistureDelta,
    pollinationMultiplier,
    flightModifier,
    currentModifier,
    hazardCues: Object.freeze(hazardCues),
    nextChangeUPulse: (bucket + 1) * WILDS_WEATHER_BUCKET_UPULSES
  });
}
