import { KAI_DAYS_PER_MONTH, KAI_MONTHS_PER_YEAR } from "./kai-klok-moment";

export type WildsSeason = "spring" | "summer" | "autumn" | "winter";

export type WildsKaiSeasonProjection = Readonly<{
  season: WildsSeason;
  seasonIndex: number;
  dayOfSeason: number;
  daysInSeason: number;
  progress: number;
}>;

const SEASONS = Object.freeze<readonly WildsSeason[]>(["spring", "summer", "autumn", "winter"]);
const MONTHS_PER_SEASON = 2;
const DAYS_IN_SEASON = KAI_DAYS_PER_MONTH * MONTHS_PER_SEASON;

export function projectWildsKaiSeason(
  input: Readonly<{ month: number; day: number }>
): WildsKaiSeasonProjection {
  if (!Number.isInteger(input.month)
    || !Number.isInteger(input.day)
    || input.month < 1
    || input.month > KAI_MONTHS_PER_YEAR
    || input.day < 1
    || input.day > KAI_DAYS_PER_MONTH) {
    throw new Error("kai_calendar_invalid");
  }

  const seasonIndex = Math.floor((input.month - 1) / MONTHS_PER_SEASON);
  const season = SEASONS[seasonIndex];
  if (!season) throw new Error("kai_calendar_invalid");
  const monthWithinSeason = (input.month - 1) % MONTHS_PER_SEASON;
  const dayOfSeason = monthWithinSeason * KAI_DAYS_PER_MONTH + input.day;

  return Object.freeze({
    season,
    seasonIndex,
    dayOfSeason,
    daysInSeason: DAYS_IN_SEASON,
    progress: (dayOfSeason - 1) / (DAYS_IN_SEASON - 1)
  });
}
