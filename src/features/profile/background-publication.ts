export type ProfilePublicationStatus = "publishing" | "ready" | "unpublished";

type Timer = ReturnType<typeof setTimeout>;

/** One background publication per profile revision; retries never require UI interaction. */
export function startWildzProfilePublication(input: {
  publish: (signal: AbortSignal) => Promise<unknown>;
  onStatus: (status: ProfilePublicationStatus) => void;
  isOnline: () => boolean;
  schedule: (task: () => Promise<void>) => Promise<void>;
  setTimer?: (callback: () => void, delay: number) => Timer;
  clearTimer?: (timer: Timer) => void;
}) {
  const setTimer = input.setTimer ?? setTimeout;
  const clearTimer = input.clearTimer ?? clearTimeout;
  let active = true;
  let complete = false;
  let pending = false;
  let retryDelay = 15_000;
  let timer: Timer | undefined;
  let deadline: Timer | undefined;
  let controller: AbortController | undefined;
  const wake = () => {
    if (!active || complete || pending) return;
    if (timer !== undefined) clearTimer(timer);
    timer = undefined;
    if (!input.isOnline()) {
      input.onStatus("unpublished");
      return;
    }
    pending = true;
    input.onStatus("publishing");
    void input.schedule(async () => {
      if (!active) return;
      controller = new AbortController();
      deadline = setTimer(() => controller?.abort(), 30_000);
      await input.publish(controller.signal);
      if (!active) return;
      controller.signal.throwIfAborted();
      complete = true;
      input.onStatus("ready");
    }).catch(() => {
      if (active) input.onStatus("unpublished");
    }).finally(() => {
      pending = false;
      if (deadline !== undefined) clearTimer(deadline);
      if (active && !complete) {
        timer = setTimer(wake, retryDelay);
        retryDelay = Math.min(retryDelay * 2, 60_000);
      }
    });
  };
  // Show queued work immediately, then leave the interaction frame to the UI.
  input.onStatus(input.isOnline() ? "publishing" : "unpublished");
  timer = setTimer(wake, 300);
  return {
    wake,
    stop() {
      active = false;
      if (timer !== undefined) clearTimer(timer);
      if (deadline !== undefined) clearTimer(deadline);
      controller?.abort();
    }
  };
}
