/** Keeps asynchronous compilation out of normal render frames. Context restoration
 * starts a new generation so a disposed context can never release the draw gate. */
export function createWildsShaderWarmup(compile: () => Promise<unknown>, invalidate: () => void) {
  let generation = 0, started = false, ready = false;
  return {
    reset() { generation++; started = false; ready = false; },
    frame(draw: () => void) {
      if (ready) { draw(); return; }
      if (started) return;
      started = true;
      const version = generation;
      void Promise.resolve().then(compile).catch(() => {
        // The normal renderer reports unsupported-driver/shader failures.
      }).then(() => {
        if (version !== generation) return;
        ready = true;
        invalidate();
      });
    }
  };
}
