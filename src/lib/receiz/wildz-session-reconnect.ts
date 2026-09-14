type Timer = ReturnType<typeof setTimeout>;

/** Retry a failed proof-session connection without blocking admitted local gameplay. */
export function startWildzSessionReconnect(input: {
  connect: () => Promise<boolean>;
  setTimer?: (callback: () => void, delay: number) => Timer;
  clearTimer?: (timer: Timer) => void;
}) {
  const setTimer = input.setTimer ?? setTimeout;
  const clearTimer = input.clearTimer ?? clearTimeout;
  let stopped = false;
  let pending = false;
  let timer: Timer | undefined;
  let delay = 1_000;
  const wake = () => {
    if (stopped || pending) return;
    if (timer !== undefined) clearTimer(timer);
    timer = undefined;
    pending = true;
    void Promise.resolve().then(() => stopped ? true : input.connect()).catch(() => false).then(connected => {
      pending = false;
      if (stopped) return;
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
