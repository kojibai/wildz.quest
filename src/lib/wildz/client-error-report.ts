export const WILDZ_CLIENT_ERROR_KEY = "wildz:client-errors:v1";
type ErrorStorage = Pick<Storage, "getItem" | "setItem">;
const clean = (text: string, limit: number) => text.slice(0, limit).replace(/https?:\/\/[^\s)]+/g, value => {
  try { const url = new URL(value); return `${url.origin}${url.pathname}`; } catch { return "[url]"; }
}).slice(0, limit);

/** Bounded local error fields only, with no game-state capture or network
 * reporting. Malformed error fields/storage cannot prevent recovery. */
export function recordWildzClientError(error: unknown, storage?: ErrorStorage | null) {
  const report = { at: new Date().toISOString(), name: "Error", message: "Unexpected client error", stack: "" };
  try {
    const source = error instanceof Error ? error : new Error(typeof error === "string" ? error : report.message);
    const { name, message, stack } = source;
    Object.assign(report, { name: clean(typeof name === "string" ? name : "Error", 80),
      message: clean(typeof message === "string" ? message : report.message, 400), stack: clean(typeof stack === "string" ? stack : "", 2400) });
  } catch { /* Retain the safe fallback instead of recursively reporting a bad error object. */ }
  try {
    let previous: unknown;
    try { previous = JSON.parse(storage?.getItem(WILDZ_CLIENT_ERROR_KEY) ?? "[]"); } catch { previous = []; }
    const records = Array.isArray(previous) ? previous.filter(item => item && typeof item === "object"
      && typeof item.at === "string" && typeof item.message === "string" && typeof item.stack === "string") : [];
    storage?.setItem(WILDZ_CLIENT_ERROR_KEY, JSON.stringify([...records.slice(-3).map(item => ({
      at: clean(item.at, 40), name: clean(typeof item.name === "string" ? item.name : "Error", 80),
      message: clean(item.message, 400), stack: clean(item.stack, 2400)
    })), report]));
  } catch { /* A full or unavailable browser store never prevents recovery. */ }
  return report;
}
