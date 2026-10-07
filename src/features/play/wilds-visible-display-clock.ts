/** Display-only ticks stop while hidden. Elapsed game time remains authoritative
 * and is read once on return; game settlement and save timers are independent. */
export function startWildsVisibleDisplayClock<Timer>(input: {
  hidden(): boolean; read(): void; schedule(tick: () => void): Timer; cancel(timer: Timer): void;
}) {
  let disposed = false, hidden: boolean | undefined, timer: Timer | undefined;
  const cancel = () => { if (timer !== undefined) input.cancel(timer); timer = undefined; };
  const tick = () => {
    if (disposed) return;
    if (input.hidden()) { visibilityChanged(); return; }
    timer = undefined;
    input.read();
    timer = input.schedule(tick);
  };
  const visibilityChanged = () => {
    if (disposed || hidden === input.hidden()) return;
    hidden = input.hidden(); cancel();
    if (!hidden) { input.read(); timer = input.schedule(tick); }
  };
  visibilityChanged();
  return { visibilityChanged, dispose() { disposed = true; cancel(); } };
}
