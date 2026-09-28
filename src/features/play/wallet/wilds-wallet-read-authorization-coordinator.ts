/** GET and POST share a one-time browser ticket cookie. A session renewal must
 * join its unfinished exchange instead of replacing that ticket mid-flight. */
export function createWildsWalletReadAuthorizationCoordinator() {
  const pending = new Map<string, Promise<boolean>>();
  let tail: Promise<unknown> = Promise.resolve();
  return (key: string, authorize: () => Promise<boolean>): Promise<boolean> => {
    const current = pending.get(key);
    if (current) return current;
    const operation = tail.then(authorize);
    pending.set(key, operation);
    const settled = operation.then(() => { pending.delete(key); }, () => { pending.delete(key); });
    tail = settled;
    return operation;
  };
}
