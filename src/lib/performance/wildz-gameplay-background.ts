type BackgroundPostTask = <Value>(
  task: () => Value | Promise<Value>,
  options: { priority: "background" }
) => Promise<Value>;

type IdleRequest = (callback: () => void, options: { timeout: number }) => number;

export type WildzGameplayBackgroundRunner = {
  run<Value>(task: () => Value | Promise<Value>, options?: { timeoutMs?: number }): Promise<Value>;
};

type BackgroundEnvironment = {
  postTask?: BackgroundPostTask;
  requestIdleCallback?: IdleRequest;
  cancelIdleCallback?: (handle: number) => void;
  requestAnimationFrame?: (callback: () => void) => number;
  setTimer?: (callback: () => void, delayMs: number) => number | ReturnType<typeof setTimeout>;
};

function browserEnvironment(): BackgroundEnvironment {
  if (typeof window === "undefined") return {};
  const browserScheduler = (globalThis as typeof globalThis & {
    scheduler?: { postTask?: BackgroundPostTask };
  }).scheduler;
  return {
    postTask: browserScheduler?.postTask?.bind(browserScheduler),
    requestIdleCallback: typeof window.requestIdleCallback === "function"
      ? ((callback, options) => window.requestIdleCallback(callback, options))
      : undefined,
    cancelIdleCallback: typeof window.cancelIdleCallback === "function"
      ? ((handle) => window.cancelIdleCallback(handle))
      : undefined,
    requestAnimationFrame: (callback) => window.requestAnimationFrame(callback),
    setTimer: (callback, delayMs) => window.setTimeout(callback, delayMs)
  };
}

export function createWildzGameplayBackgroundRunner(
  environment: BackgroundEnvironment = browserEnvironment()
): WildzGameplayBackgroundRunner {
  return {
    run<Value>(task: () => Value | Promise<Value>, options: { timeoutMs?: number } = {}) {
      const timeoutMs = Math.max(50, Math.floor(options.timeoutMs ?? 1_000));
      if (environment.postTask) return environment.postTask(task, { priority: "background" });
      if (environment.requestIdleCallback) {
        return new Promise<Value>((resolve, reject) => {
          environment.requestIdleCallback!(() => {
            Promise.resolve().then(task).then(resolve, reject);
          }, { timeout: timeoutMs });
        });
      }
      return new Promise<Value>((resolve, reject) => {
        const setTimer = environment.setTimer ?? ((callback: () => void, delayMs: number) => setTimeout(callback, delayMs));
        const run = () => setTimer(() => {
          Promise.resolve().then(task).then(resolve, reject);
        }, 0);
        if (environment.requestAnimationFrame) environment.requestAnimationFrame(run);
        else run();
      });
    }
  };
}

export const wildzGameplayBackground = createWildzGameplayBackgroundRunner();
