type Timer = ReturnType<typeof setTimeout>;

/** Retry a failed proof-session connection without blocking admitted local gameplay. */
export function startWildzSessionReconnect(input: {
  connect: () => Promise<boolean>;
  isOnline?: () => boolean;
  setTimer?: (callback: () => void, delay: number) => Timer;
  clearTimer?: (timer: Timer) => void;
}) {
  const setTimer = input.setTimer ?? setTimeout;
  const clearTimer = input.clearTimer ?? clearTimeout;
  const isOnline = input.isOnline ?? (() => true);
  let stopped = false;
  let pending = false;
  let timer: Timer | undefined;
  let delay = 1_000;
  const wake = () => {
    if (stopped || pending) return;
    if (timer !== undefined) clearTimer(timer);
    timer = undefined;
    if (!isOnline()) return;
    pending = true;
    void Promise.resolve().then(() => stopped || !isOnline() ? false : input.connect()).catch(() => false).then(connected => {
      pending = false;
      if (stopped || !isOnline()) return;
      if (connected) { delay = 1_000; return; }
      timer = setTimer(wake, delay);
      delay = Math.min(delay * 2, 30_000);
    });
  };
  wake();
  return {
    wake,
    stop() { stopped = true; if (timer !== undefined) clearTimer(timer); }
  };
}
