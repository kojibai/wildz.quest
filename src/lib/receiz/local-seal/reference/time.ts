export function formatReceizTimestampNY(d: Date): string {
  // Display format: YYYY-MM-DD HH:MM (no timezone shown)
  // Authoritative moment rendered in America/New_York.
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/New_York",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(d);

  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? "";

  const yyyy = get("year");
  const mm = get("month");
  const dd = get("day");
  const HH = get("hour");
  const MM = get("minute");

  return `${yyyy}-${mm}-${dd} ${HH}:${MM}`;
}

const CHRONOS_UTC_FALLBACK_TIME_ZONE = "UTC";
const DEFAULT_CHRONOS_DISPLAY_LOCALE = "en-US";

type ChronosDisplayValue = string | number | Date | null | undefined;

type ChronosDisplayOptions = Omit<Intl.DateTimeFormatOptions, "timeZone"> & {
  locale?: string | readonly string[];
  timeZone?: string | null;
  unavailableLabel?: string;
};

function isValidTimeZone(value: string): boolean {
  try {
    new Intl.DateTimeFormat(DEFAULT_CHRONOS_DISPLAY_LOCALE, { timeZone: value }).format(new Date(0));
    return true;
  } catch {
    return false;
  }
}

export function resolveChronosDisplayTimeZone(preferredTimeZone?: string | null): string {
  if (preferredTimeZone !== undefined && preferredTimeZone !== null) {
    const preferred = preferredTimeZone.trim();
    return preferred && isValidTimeZone(preferred) ? preferred : CHRONOS_UTC_FALLBACK_TIME_ZONE;
  }

  if (typeof window === "undefined") return CHRONOS_UTC_FALLBACK_TIME_ZONE;

  try {
    const resolved = Intl.DateTimeFormat().resolvedOptions().timeZone;
    if (resolved && isValidTimeZone(resolved)) return resolved;
  } catch {
    // UTC is the product fallback when the device timezone is unavailable.
  }

  return CHRONOS_UTC_FALLBACK_TIME_ZONE;
}

function chronosDate(value: ChronosDisplayValue): Date | null {
  if (value instanceof Date) {
    const ms = value.getTime();
    return Number.isFinite(ms) ? value : null;
  }

  if (typeof value === "number") {
    return Number.isFinite(value) ? new Date(value) : null;
  }

  if (typeof value === "string") {
    const parsed = Date.parse(value);
    return Number.isFinite(parsed) ? new Date(parsed) : null;
  }

  return null;
}

export function formatChronosDisplay(value: ChronosDisplayValue, options: ChronosDisplayOptions): string {
  const date = chronosDate(value);
  const unavailableLabel = options.unavailableLabel ?? "Chronos unavailable";
  if (!date) return unavailableLabel;

  const { locale, timeZone, ...dateTimeOptions } = options;
  delete dateTimeOptions.unavailableLabel;
  const resolvedTimeZone = resolveChronosDisplayTimeZone(timeZone);

  try {
    return new Intl.DateTimeFormat(locale ?? DEFAULT_CHRONOS_DISPLAY_LOCALE, {
      ...dateTimeOptions,
      timeZone: resolvedTimeZone,
    }).format(date);
  } catch {
    return new Intl.DateTimeFormat(locale ?? DEFAULT_CHRONOS_DISPLAY_LOCALE, {
      ...dateTimeOptions,
      timeZone: CHRONOS_UTC_FALLBACK_TIME_ZONE,
    }).format(date);
  }
}

function chronosDayKey(value: ChronosDisplayValue, timeZone?: string | null): string | null {
  const date = chronosDate(value);
  if (!date) return null;

  const formatter = new Intl.DateTimeFormat("en-CA", {
    timeZone: resolveChronosDisplayTimeZone(timeZone),
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });

  return formatter.format(date);
}

export function isSameChronosDisplayDay(
  left: ChronosDisplayValue,
  right: ChronosDisplayValue,
  timeZone?: string | null,
): boolean {
  const leftKey = chronosDayKey(left, timeZone);
  const rightKey = chronosDayKey(right, timeZone);
  return leftKey !== null && leftKey === rightKey;
}
