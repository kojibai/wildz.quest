/** Queue nonvisual preparation outside the frame that reveals an overlay. */
export function scheduleAfterPaint(task: () => void, runtime: {
  requestAnimationFrame(callback: FrameRequestCallback): number;
  cancelAnimationFrame(handle: number): void;
  setTimeout(callback: () => void, delay: number): number;
  clearTimeout(handle: number): void;
} = window): () => void {
  let cancelled = false;
  let timer: number | undefined;
  const frame = runtime.requestAnimationFrame(() => {
    if (cancelled) return;
    timer = runtime.setTimeout(() => { if (!cancelled) task(); }, 0);
  });
  return () => {
    cancelled = true;
    runtime.cancelAnimationFrame(frame);
    if (timer !== undefined) runtime.clearTimeout(timer);
  };
}
