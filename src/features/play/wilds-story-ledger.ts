import type { WildsActivityEntry } from "./wallet/wilds-activity-history";

export const WILDS_STORY_LEDGER_PAGE_SIZE = 12;

export function indexWildsStoryLedger(entries: readonly WildsActivityEntry[]) {
  return [...entries].sort((left, right) => right.uPulse - left.uPulse || left.id.localeCompare(right.id));
}

export function pageWildsStoryLedger(entries: readonly WildsActivityEntry[], requestedPage: number) {
  const pageCount = Math.max(1, Math.ceil(entries.length / WILDS_STORY_LEDGER_PAGE_SIZE));
  const page = Math.max(0, Math.min(pageCount - 1, Number.isFinite(requestedPage) ? Math.floor(requestedPage) : 0));
  const offset = page * WILDS_STORY_LEDGER_PAGE_SIZE;
  return { page, pageCount, total: entries.length, start: entries.length ? offset + 1 : 0,
    end: Math.min(entries.length, offset + WILDS_STORY_LEDGER_PAGE_SIZE),
    entries: entries.slice(offset, offset + WILDS_STORY_LEDGER_PAGE_SIZE) };
}
