const queueKey = Symbol.for("wildz.resource-package-market.mutation-queue.v1");
type QueueRoot = typeof globalThis & { [queueKey]?: Promise<void> };
/** Serializes projection updates within a server instance. Native canonical
 * package reservations remain required before every payment and claim. */
export function serializeResourcePackageMarketMutation<T>(operation: () => Promise<T>): Promise<T> {
  const root = globalThis as QueueRoot;
  const previous = root[queueKey] ?? Promise.resolve();
  const result = previous.then(operation, operation);
  root[queueKey] = result.then(() => undefined, () => undefined);
  return result;
}
