export const KAI_GENESIS_TS = 1_715_323_541_888 as const;
export const KAI_N_DAY_MICRO = 17_491_270_421n;
export const KAI_BASE_DAY_MICRO = 17_424_000_000n;
export const KAI_PULSES_PER_STEP = 11 as const;
export const KAI_STEPS_PER_BEAT = 44 as const;
export const KAI_BEATS_PER_DAY = 36 as const;
export const KAI_PULSES_PER_STEP_MICRO = 11_000_000n;
export const KAI_PULSES_PER_BEAT_MICRO = 484_000_000n;
export const KAI_DAYS_PER_WEEK = 6 as const;
export const KAI_DAYS_PER_MONTH = 42 as const;
export const KAI_MONTHS_PER_YEAR = 8 as const;
export const KAI_DAYS_PER_YEAR = 336 as const;

const INV_T_NUM = BigInt("190983005625052575897706582817180941139845410097118568932275689");
const INV_T_DEN = 10n ** 60n;

export type KaiWeekday = "Solhara" | "Aquaris" | "Flamora" | "Verdari" | "Sonari" | "Kaelith";
export type KaiChakra = "Root" | "Sacral" | "Solar Plexus" | "Heart" | "Throat" | "Third Eye" | "Crown";
export type KaiWeekName = "Awakening Flame" | "Flowing Heart" | "Radiant Will" | "Harmonic Voh" | "Inner Mirror" | "Dreamfire Memory" | "Krowned Light";
export type KaiMonthName = "Aethon" | "Virelai" | "Solari" | "Amarin" | "Kaelus" | "Umbriel" | "Noktura" | "Liora";
export type KaiArkName = "Ignite" | "Integrate" | "Harmonize" | "Reflekt" | "Purify" | "Dream";
export type KaiMomentAuthority = "admitted" | "world" | "local";

export const KAI_CHAKRA_GEOMETRY = {
  Root: { accent: "#CC3F3F", hue: 0, sides: 4, gate: "Earth Gate" },
  Sacral: { accent: "#E86428", hue: 24, sides: 6, gate: "Water Gate" },
  "Solar Plexus": { accent: "#E6B844", hue: 48, sides: 5, gate: "Fire Gate" },
  Heart: { accent: "#2CCB99", hue: 140, sides: 8, gate: "Air Gate" },
  Throat: { accent: "#00D5AA", hue: 190, sides: 12, gate: "Will Gate" },
  "Third Eye": { accent: "#6B4AC0", hue: 260, sides: 14, gate: "Light Gate" },
  Crown: { accent: "#C25AA4", hue: 300, sides: 16, gate: "Ether Gate" }
} as const;

export type KaiKlokMoment = {
  authority: KaiMomentAuthority;
  pulse: number;
  beat: number;
  stepIndex: number;
  pulseInStep: number;
  percentIntoPulse: number;
  stepPctAcrossBeat: number;
  weekday: KaiWeekday;
  chakra: KaiChakra;
  year: number;
  month: number;
  day: number;
  week: number;
  weekName: KaiWeekName;
  monthName: KaiMonthName;
  ark: KaiArkName;
  arkIndex: number;
  latticeCoordinate: string;
  coordinate: string;
  accent: string;
  hue: number;
  sides: number;
  gate: string;
};

const WEEKDAYS: readonly KaiWeekday[] = ["Solhara", "Aquaris", "Flamora", "Verdari", "Sonari", "Kaelith"];
export const KAI_WEEK_NAMES: readonly KaiWeekName[] = ["Awakening Flame", "Flowing Heart", "Radiant Will", "Harmonic Voh", "Inner Mirror", "Dreamfire Memory", "Krowned Light"];
export const KAI_MONTH_NAMES: readonly KaiMonthName[] = ["Aethon", "Virelai", "Solari", "Amarin", "Kaelus", "Umbriel", "Noktura", "Liora"];
export const KAI_ARK_NAMES: readonly KaiArkName[] = ["Ignite", "Integrate", "Harmonize", "Reflekt", "Purify", "Dream"];
const DAY_TO_CHAKRA: Record<KaiWeekday, KaiChakra> = {
  Solhara: "Root",
  Aquaris: "Sacral",
  Flamora: "Solar Plexus",
  Verdari: "Heart",
  Sonari: "Throat",
  Kaelith: "Crown"
};

const abs = (value: bigint) => value < 0n ? -value : value;

function modE(value: bigint, divisor: bigint) {
  const result = value % divisor;
  return result >= 0n ? result : result + divisor;
}

function floorDivE(value: bigint, divisor: bigint) {
  const quotient = value / divisor;
  const remainder = value % divisor;
  return remainder === 0n || value >= 0n ? quotient : quotient - 1n;
}

function mulDivRoundHalfEven(value: bigint, numerator: bigint, denominator: bigint) {
  if (denominator <= 0n) throw new Error("wilds_kai_moment_denominator_invalid");
  const sign = (value < 0n ? -1n : 1n) * (numerator < 0n ? -1n : 1n);
  const product = abs(value) * abs(numerator);
  const quotient = product / denominator;
  const remainder = product % denominator;
  const twice = remainder * 2n;
  const rounded = twice > denominator || (twice === denominator && (quotient & 1n) === 1n)
    ? quotient + 1n
    : quotient;
  return sign * rounded;
}

function safeInteger(value: bigint) {
  const max = BigInt(Number.MAX_SAFE_INTEGER);
  const min = BigInt(Number.MIN_SAFE_INTEGER);
  if (value > max || value < min) throw new Error("wilds_kai_moment_range_invalid");
  return Number(value);
}

function pad2(value: number) {
  return String(value).padStart(2, "0");
}

export function deriveKaiKlokMoment(input: {
  occurredAt: string;
  authority: KaiMomentAuthority;
}): KaiKlokMoment {
  const epochMs = Date.parse(input.occurredAt);
  if (!Number.isFinite(epochMs) || new Date(epochMs).toISOString() !== input.occurredAt) {
    throw new Error("wilds_kai_moment_time_invalid");
  }

  const microPulses = mulDivRoundHalfEven(BigInt(epochMs - KAI_GENESIS_TS), INV_T_NUM, INV_T_DEN);
  const pulse = safeInteger(floorDivE(microPulses, 1_000_000n));
  const pulseFractionMicro = modE(microPulses, 1_000_000n);
  const pulsesInGrid = modE(microPulses, KAI_N_DAY_MICRO) % KAI_BASE_DAY_MICRO;
  const beat = Number(pulsesInGrid / KAI_PULSES_PER_BEAT_MICRO);
  const pulsesInBeat = pulsesInGrid - BigInt(beat) * KAI_PULSES_PER_BEAT_MICRO;
  const stepIndex = Number(pulsesInBeat / KAI_PULSES_PER_STEP_MICRO);
  const pulsesInStep = pulsesInBeat - BigInt(stepIndex) * KAI_PULSES_PER_STEP_MICRO;
  const pulseInStep = Number(pulsesInStep / 1_000_000n);
  const percentIntoPulse = Number(pulseFractionMicro) / 1_000_000;
  const stepPctAcrossBeat = (stepIndex + Number(pulsesInStep) / Number(KAI_PULSES_PER_STEP_MICRO)) / KAI_STEPS_PER_BEAT;

  const dayIndex = floorDivE(microPulses, KAI_N_DAY_MICRO);
  const microPulsesInDay = modE(microPulses, KAI_N_DAY_MICRO);
  const weekday = WEEKDAYS[Number(modE(dayIndex, BigInt(WEEKDAYS.length)))]!;
  const chakra = DAY_TO_CHAKRA[weekday];
  const year = safeInteger(floorDivE(dayIndex, BigInt(KAI_DAYS_PER_YEAR)));
  const month = Number(modE(floorDivE(dayIndex, BigInt(KAI_DAYS_PER_MONTH)), BigInt(KAI_MONTHS_PER_YEAR))) + 1;
  const day = Number(modE(dayIndex, BigInt(KAI_DAYS_PER_MONTH))) + 1;
  const week = Math.floor((day - 1) / KAI_DAYS_PER_WEEK) + 1;
  const weekName = KAI_WEEK_NAMES[week - 1]!;
  const monthName = KAI_MONTH_NAMES[month - 1]!;
  const arkIndex = Math.min(5, Number((microPulsesInDay * 6n) / KAI_N_DAY_MICRO));
  const ark = KAI_ARK_NAMES[arkIndex]!;
  const latticeCoordinate = `${pad2(beat)}:${pad2(stepIndex)}:${pad2(pulseInStep)}`;
  const coordinate = `Y${year}·M${month}·D${day}·${latticeCoordinate}·KAI${pulse}`;

  return {
    authority: input.authority,
    pulse,
    beat,
    stepIndex,
    pulseInStep,
    percentIntoPulse,
    stepPctAcrossBeat,
    weekday,
    chakra,
    year,
    month,
    day,
    week,
    weekName,
    monthName,
    ark,
    arkIndex,
    latticeCoordinate,
    coordinate,
    ...KAI_CHAKRA_GEOMETRY[chakra]
  };
}
