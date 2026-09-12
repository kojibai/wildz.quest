import { KAI_DAYS_PER_YEAR, KAI_N_DAY_MICRO } from "./kai-klok-moment";
import type { WildsWeather } from "./wilds-biome";

export type WildsWindVector = { x: number; z: number };
const DAY = Number(KAI_N_DAY_MICRO);
function noise(cell: number, salt: number) {
  let hash = Math.imul(cell ^ salt, 0x45d9f3b);
  hash = Math.imul(hash ^ (hash >>> 16), 0x45d9f3b);
  return ((hash ^ (hash >>> 16)) >>> 0) / 0xffffffff * 2 - 1;
}
function field(coordinate: number, salt: number) {
  const cell = Math.floor(coordinate), fraction = coordinate - cell;
  const blend = fraction * fraction * (3 - 2 * fraction);
  return noise(cell, salt) * (1 - blend) + noise(cell + 1, salt) * blend;
}

/** Kai calendar seasons, not a claim about observed Earth weather. Daily heating
 * and the 336-day year shape an evolving field, with no short animation loop. */
export function wildsKaiWindClimate(uPulse: number, weather: WildsWeather) {
  if (!Number.isSafeInteger(uPulse) || uPulse < 0) throw new Error("wilds_wind_kai_invalid");
  const day = uPulse / DAY;
  const seasonal = .82 + .18 * Math.cos(day / KAI_DAYS_PER_YEAR * Math.PI * 2);
  const daytime = .78 + .22 * Math.sin(day * Math.PI * 2);
  return .026 * seasonal * daytime * (weather === "sun-shower" ? 1.25 : weather === "pollen-drift" ? .8 : 1);
}

/** Writes a bounded visual displacement into reusable storage. Canonical time
 * and world position select the same wind after restore or on another client. */
export function writeWildsKaiWind(target: WildsWindVector, uPulse: number, x: number, z: number, climate: number) {
  const pulse = uPulse / 1_000_000;
  const place = x * .011 + z * .017;
  const gust = field(pulse / 1.37 + place, 71) * .24;
  target.x = (field(pulse / 13.7 + place, 193) * .72 + gust) * climate;
  target.z = (field(pulse / 19.3 - place, 389) * .72 - gust * .6) * climate;
  return target;
}

export type WildsKaiWeatherSample = {
  windX: number; windZ: number; windSpeed: number; precipitation: number;
  temperature: number; storm: boolean; snow: boolean; flightLoad: number;
};
export function createWildsKaiWeatherSample(): WildsKaiWeatherSample {
  return { windX: 0, windZ: 0, windSpeed: 0, precipitation: 0, temperature: .5, storm: false, snow: false, flightLoad: 0 };
}

/** A continuous weather field keyed to absolute Kai and world coordinates.
 * Units: wind metres/second; precipitation, temperature and flight load 0..1. */
export function writeWildsKaiWeather(target: WildsKaiWeatherSample, uPulse: number, x: number, z: number) {
  const climate = wildsKaiWindClimate(uPulse, "clear");
  const pulse = uPulse / 1_000_000, day = uPulse / DAY;
  const place = x * .011 + z * .017;
  target.precipitation = Math.min(1, Math.max(0, field(pulse / 61 + x * .003 + z * .005, 659) - .1) * 1.4);
  target.temperature = .5 + .3 * Math.sin(day / KAI_DAYS_PER_YEAR * Math.PI * 2) + .08 * Math.sin(day * Math.PI * 2);
  const gust = field(pulse / 1.37 + place, 71) * .24;
  const strength = climate * (1 + target.precipitation * .6) * 240;
  target.windX = (field(pulse / 13.7 + place, 193) * .72 + gust) * strength;
  target.windZ = (field(pulse / 19.3 - place, 389) * .72 - gust * .6) * strength;
  target.windSpeed = Math.hypot(target.windX, target.windZ);
  target.snow = target.temperature < .3 && target.precipitation > .1;
  target.storm = target.precipitation > .55 && target.windSpeed > 2.5;
  target.flightLoad = Math.min(1, target.windSpeed / 12 + target.precipitation * .3);
  return target;
}

/** Apply wind before the existing sweep/collision resolver. No wind can bypass a wall. */
export function applyWildsFlightWind<T extends { x: number; z: number }>(intended: T, player: { x: number; z: number }, weather: WildsKaiWeatherSample) {
  const distance = Math.hypot(intended.x - player.x, intended.z - player.z);
  if (distance === 0) return intended;
  const drag = 1 - weather.flightLoad * .18;
  intended.x = player.x + (intended.x - player.x) * drag + weather.windX * distance * .028;
  intended.z = player.z + (intended.z - player.z) * drag + weather.windZ * distance * .028;
  return intended;
}
