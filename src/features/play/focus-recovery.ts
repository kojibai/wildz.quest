export function canRestoreFocus(origin: HTMLElement | null): origin is HTMLElement {
  if (!origin?.isConnected) return false;
  if (origin.matches(":disabled, [aria-disabled='true'], [inert], [inert] *, [aria-hidden='true'], [aria-hidden='true'] *")) return false;
  if (origin.tabIndex < 0 || origin.hidden) return false;
  const view = origin.ownerDocument?.defaultView;
  const style = view?.getComputedStyle(origin);
  if (style?.display === "none" || style?.visibility === "hidden" || style?.visibility === "collapse") return false;
  if (typeof origin.getClientRects === "function" && origin.getClientRects().length === 0) return false;
  return true;
}
