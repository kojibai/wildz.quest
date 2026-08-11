export function canRestoreFocus(origin: HTMLElement | null): origin is HTMLElement {
  return Boolean(origin?.isConnected && !origin.matches(":disabled, [aria-disabled='true'], [inert], [inert] *"));
}
