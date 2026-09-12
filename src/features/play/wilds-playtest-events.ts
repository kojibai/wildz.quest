import { WILDS_PLAYTEST_ACTIONS, type WildsPlaytestAction, type WildsPlaytestOutcome } from "./wilds-playtest";

const EVENT_NAME = "wildz:local-playtest-mark:v1";
type Mark = { action: WildsPlaytestAction; outcome: WildsPlaytestOutcome };
function validatedMark(value: unknown): Mark | null {
  if (!value || typeof value !== "object") return null;
  const { action, outcome } = value as Mark;
  if (!WILDS_PLAYTEST_ACTIONS.includes(action) || !["start", "success", "failure"].includes(outcome)) return null;
  return { action, outcome };
}
/** Browser-local signal only. No storage or collection occurs without an opted-in listener. */
export function emitWildsPlaytestEvent(action: WildsPlaytestAction, outcome: WildsPlaytestOutcome, target: EventTarget | undefined = typeof window === "undefined" ? undefined : window): void {
  const detail = validatedMark({ action, outcome });
  if (target && detail) target.dispatchEvent(new CustomEvent(EVENT_NAME, { detail }));
}
export function listenWildsPlaytestEvents(target: EventTarget, mark: (action: WildsPlaytestAction, outcome: WildsPlaytestOutcome) => void): () => void {
  const listener = (event: Event) => {
    // Copy only the fixed vocabulary even if another script sends additional fields.
    let detail: Mark | null = null;
    try { detail = validatedMark((event as CustomEvent<unknown>).detail); } catch { return; }
    if (detail) mark(detail.action, detail.outcome);
  };
  target.addEventListener(EVENT_NAME, listener);
  return () => target.removeEventListener(EVENT_NAME, listener);
}
