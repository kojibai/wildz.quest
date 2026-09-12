/** Share startup recovery with early actions; retry failures without replaying each action. */
export function createWildsSessionRestore(restore: () => Promise<unknown>) {
  let pending: Promise<void> | null = null;
  return () => {
    if (!pending) pending = Promise.resolve().then(restore).then(() => undefined).catch(error => {
      pending = null;
      throw error;
    });
    return pending;
  };
}
