import { scheduleAfterPaint } from '../play/schedule-after-paint';

export type ProfilePreviewScheduler = (task: () => void) => () => void;

/** A single visible preview per paint keeps a gallery reveal from mounting a full card batch. */
export function createProfilePreviewQueue(schedule: ProfilePreviewScheduler): { enqueue(task: () => void): () => void } {
  const tasks = new Map<symbol, () => void>();
  let cancelScheduled: (() => void) | null = null;
  const scheduleNext = () => {
    if (cancelScheduled || !tasks.size) return;
    cancelScheduled = schedule(() => {
      cancelScheduled = null;
      const next = tasks.entries().next().value;
      if (!next) return;
      tasks.delete(next[0]);
      try { next[1](); } finally { scheduleNext(); }
    });
  };
  return {
    enqueue(task) {
      const id = Symbol('profile-preview');
      tasks.set(id, task);
      scheduleNext();
      return () => {
        tasks.delete(id);
        if (!tasks.size) { cancelScheduled?.(); cancelScheduled = null; }
      };
    },
  };
}

const browserProfilePreviews = createProfilePreviewQueue(task => scheduleAfterPaint(task));
export const enqueueProfileCardPreview = browserProfilePreviews.enqueue;
