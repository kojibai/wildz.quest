/** Share one exact-card preparation across Vault remounts and concurrent Save clicks.
 * Keys must include the signing identity, owner and full current card fingerprint. */
export function createWildzPreparedCardCache<T>(limit = 8) {
  const entries = new Map<string, Promise<T>>();
  return {
    get(key: string, prepare: () => Promise<T>): Promise<T> {
      const existing = entries.get(key);
      if (existing) return existing;
      const pending = Promise.resolve().then(prepare).catch(error => {
        if (entries.get(key) === pending) entries.delete(key);
        throw error;
      });
      entries.set(key, pending);
      while (entries.size > limit) entries.delete(entries.keys().next().value!);
      return pending;
    }
  };
}
