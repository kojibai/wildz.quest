import type { WildzContinuityDatabase } from '@/lib/storage/wildz-indexed-db';
import type { PlayState } from './game-state';
import { hasLaterWildsPlayerLedger } from './wilds-play-state-source';
import { prepareWildzRuntimeCheckpoint, readWildzRuntimeCheckpoint, wildzRuntimeCheckpointKey, writePreparedWildzRuntimeCheckpoint } from './wildz-runtime-checkpoint';

type Scope = { keyId: string; actorId: string };
type Input = Scope & { playState: PlayState };
type StoragePort = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>;
const SCHEMA = 'wildz.runtime-checkpoint-fallback.v1';

/** Preserve the same inventory-free, owner-bound checkpoint when browser local
 * storage reaches its quota. This is a cache, never card or account authority. */
export function createWildzRuntimeCheckpointStore(options: {
  database: WildzContinuityDatabase;
  getStorage(): StoragePort;
}) {
  const fallbackKeys = new Set<string>();
  const generations = new Map<string, number>();
  const tails = new Map<string, Promise<void>>();
  const generation = (key: string) => generations.get(key) ?? 0;
  const enqueue = (key: string, action: () => Promise<void>) => {
    const next = (tails.get(key) ?? Promise.resolve()).catch(() => undefined).then(action);
    tails.set(key, next);
    void next.finally(() => { if (tails.get(key) === next) tails.delete(key); }).catch(() => undefined);
    return next;
  };
  const writePrepared = async (prepared: { key: string; serialized: string }) => {
    const epoch = generation(prepared.key);
    if (!fallbackKeys.has(prepared.key)) {
      try {
        writePreparedWildzRuntimeCheckpoint(options.getStorage(), prepared);
        return;
      } catch {
        // Do not erase saved data to make space or repeatedly retry a full quota.
        fallbackKeys.add(prepared.key);
      }
    }
    await enqueue(prepared.key, async () => {
      if (generation(prepared.key) !== epoch) return;
      await options.database.transaction(['meta'], 'readwrite', tx => tx.put('meta', {
        schema: SCHEMA, serialized: prepared.serialized
      }, prepared.key));
    });
  };
  return {
    writePrepared,
    write(input: Input) {
      const prepared = prepareWildzRuntimeCheckpoint(input);
      return writePrepared({ key: prepared.key, serialized: JSON.stringify(prepared.checkpoint) });
    },
    async read(input: Input): Promise<PlayState> {
      const key = wildzRuntimeCheckpointKey(input.keyId, input.actorId);
      let local = input.playState;
      try { local = readWildzRuntimeCheckpoint(options.getStorage(), input); } catch { /* Try the durable cache below. */ }
      const record = await options.database.read<{ schema?: unknown; serialized?: unknown }>('meta', key).catch(() => null);
      if (record?.schema !== SCHEMA || typeof record.serialized !== 'string') return local;
      let invalid = false;
      const fallback = readWildzRuntimeCheckpoint({
        getItem(readKey) {
          if (readKey === key) return record.serialized as string;
          try { return options.getStorage().getItem(readKey); } catch { return null; }
        },
        setItem() {},
        removeItem(removedKey) { if (removedKey === key) invalid = true; }
      }, input);
      if (invalid) {
        await options.database.transaction(['meta'], 'readwrite', tx => tx.delete('meta', key)).catch(() => undefined);
        return local;
      }
      fallbackKeys.add(key);
      if (hasLaterWildsPlayerLedger(local, fallback)) return local;
      if (hasLaterWildsPlayerLedger(fallback, local)) return fallback;
      return (fallback.playerBreaths?.lastKaiUPulse ?? -1) >= (local.playerBreaths?.lastKaiUPulse ?? -1) ? fallback : local;
    },
    clear(scope: Scope) {
      const key = wildzRuntimeCheckpointKey(scope.keyId, scope.actorId);
      generations.set(key, generation(key) + 1);
      fallbackKeys.delete(key);
      try { options.getStorage().removeItem(key); } catch { /* The durable cache still has to be cleared. */ }
      return enqueue(key, () => options.database.transaction(['meta'], 'readwrite', tx => tx.delete('meta', key)));
    }
  };
}
