import type { WildzContinuityDatabase } from "@/lib/storage/wildz-indexed-db";
import type { PlayState } from "./game-state";
import {
  mergeWildsExplorationAtlases, normalizeWildsExplorationAtlas,
  wildsExplorationCheckpointDelta, type WildsExplorationAtlas
} from "./wilds-exploration-atlas";
import { hasLaterWildsPlayerLedger, retainWildsExploration, wildsPlayerLedgerPulse } from "./wilds-play-state-source";
import {
  WILDZ_RUNTIME_MOVEMENT_SCHEMA, prepareWildzRuntimeCheckpoint, readWildzRuntimeCheckpoint,
  wildzRuntimeCheckpointKey, writePreparedWildzRuntimeCheckpoint
} from "./wildz-runtime-checkpoint";

type Scope = { keyId: string; actorId: string };
type Input = Scope & { playState: PlayState; restoreEpoch?: number; durableOwner?: boolean };
type Base = {
  id: string;
  atlas: WildsExplorationAtlas;
  epoch: number;
  lastAtlas?: WildsExplorationAtlas;
  lastMovement?: string;
  interrupted?: { keys: Set<string>; atlas: WildsExplorationAtlas; pulse: number; breath: number };
};
type StoredBase = Scope & { id: string; atlas: WildsExplorationAtlas };
type LegacyRecord = { schema?: string; serialized?: string; atlasGeneration?: string };
type MovementHead = { id: string; pulse: number; breath: number };
type Exit = { after: string | null; serialized: string; delta: WildsExplorationAtlas };
type StoragePort = Pick<Storage, "length" | "key" | "getItem" | "setItem" | "removeItem">;

const rootPosition = { x: 0, z: 0 };
const witnessSchema = "wildz.runtime-checkpoint-atlas-generation.v2";
const fallbackSchema = "wildz.runtime-checkpoint-fallback.v1";
const keyFor = (scope: Scope) => wildzRuntimeCheckpointKey(scope.keyId, scope.actorId);
const baseKey = (key: string) => key + ":atlas-base";
const tokenKey = (key: string) => key + ":atlas-generation";
const movesKey = (key: string) => key + ":movement";
const headKey = (key: string) => key + ":movement:head";
const deltaKey = (key: string) => key + ":discoveries";
const exitPrefix = (key: string) => key + ":exit:";
const hasDiscoveries = (atlas: WildsExplorationAtlas) => atlas.rows.length > 0 || atlas.siteKeys.length > 0;

function matchingBase(saved: StoredBase | null, id: string, owner: Input) {
  if (!saved || saved.id !== id || saved.keyId !== owner.keyId || saved.actorId !== owner.actorId
    || saved.atlas?.version !== 1 || !Array.isArray(saved.atlas.rows) || !Array.isArray(saved.atlas.siteKeys)) return null;
  const base = normalizeWildsExplorationAtlas(saved.atlas, rootPosition);
  const held = normalizeWildsExplorationAtlas(owner.playState.explorationAtlas, rootPosition);
  if (hasDiscoveries(wildsExplorationCheckpointDelta(held, base))) return null;
  return hasDiscoveries(wildsExplorationCheckpointDelta(base, held)) ? base : held;
}

function additionsSinceCommit(base: Base, current: WildsExplorationAtlas) {
  return wildsExplorationCheckpointDelta(
    normalizeWildsExplorationAtlas(base.lastAtlas ?? base.atlas, rootPosition),
    normalizeWildsExplorationAtlas(current, rootPosition)
  );
}

function selectMovement(first: PlayState, second: PlayState) {
  if (hasLaterWildsPlayerLedger(first, second)) return retainWildsExploration(first, second);
  if (hasLaterWildsPlayerLedger(second, first)) return retainWildsExploration(second, first);
  return (second.playerBreaths?.lastKaiUPulse ?? -1) >= (first.playerBreaths?.lastKaiUPulse ?? -1)
    ? retainWildsExploration(second, first) : retainWildsExploration(first, second);
}

/** Owner-bound movement cache. Inventory and the held owner state continue to
 * enter through their existing readers. A missing durable base uses full v1. */
export function createWildzRuntimeCheckpointStore(options: {
  database: WildzContinuityDatabase;
  getStorage(): StoragePort;
}) {
  const fallbackKeys = new Set<string>();
  const bases = new Map<string, Base>();
  const issued = new Map<string, number>();
  const generations = new Map<string, number>();
  const tails = new Map<string, Promise<void>>();
  const generation = (key: string) => generations.get(key) ?? 0;

  function enqueue(key: string, action: () => Promise<void>) {
    const next = (tails.get(key) ?? Promise.resolve()).catch(() => undefined).then(action);
    tails.set(key, next);
    void next.finally(() => { if (tails.get(key) === next) tails.delete(key); }).catch(() => undefined);
    return next;
  }

  // Exit keys are immutable. A reopened process can retire precisely the exits
  // it recovered, even if their original tabs write again during cleanup.
  function exitKeys(prefix: string): string[] {
    try {
      const storage = options.getStorage();
      return Array.from({ length: storage.length }, (_, i) => storage.key(i))
        .filter((key): key is string => key !== null && key.startsWith(prefix));
    } catch { return []; }
  }

  function removeLocal(key: string) {
    try { options.getStorage().removeItem(key); } catch { /* IDB remains usable without local storage. */ }
  }

  async function writePrepared(prepared: { key: string; serialized: string }) {
    const epoch = generation(prepared.key);
    if (!fallbackKeys.has(prepared.key)) {
      try {
        writePreparedWildzRuntimeCheckpoint(options.getStorage(), prepared);
        return;
      } catch { fallbackKeys.add(prepared.key); }
    }
    await enqueue(prepared.key, async () => {
      if (generation(prepared.key) !== epoch) return;
      await options.database.transaction(["meta"], "readwrite", tx =>
        tx.put("meta", { schema: fallbackSchema, serialized: prepared.serialized }, prepared.key));
    });
  }

  function readSerialized(serialized: string, input: Input, movement: boolean) {
    const key = keyFor(input);
    let invalid = false;
    const state = readWildzRuntimeCheckpoint({
      getItem(readKey) {
        if (readKey === key) return serialized;
        try { return options.getStorage().getItem(readKey); } catch { return null; }
      },
      setItem() {},
      removeItem(removedKey) { if (removedKey === key) invalid = true; }
    }, input, movement);
    return invalid ? null : state;
  }

  async function readLegacy(input: Input, record: LegacyRecord | null) {
    const key = keyFor(input);
    let local = input.playState;
    try { local = readWildzRuntimeCheckpoint(options.getStorage(), input); } catch { /* Try IDB. */ }
    if (record?.schema !== fallbackSchema || typeof record.serialized !== "string") return local;
    const fallback = readSerialized(record.serialized, input, false);
    if (!fallback) {
      await options.database.transaction(["meta"], "readwrite", async tx => {
        const latest = await tx.get<typeof record>("meta", key);
        if (latest?.serialized === record.serialized) await tx.delete("meta", key);
      }).catch(() => undefined);
      return local;
    }
    fallbackKeys.add(key);
    return selectMovement(local, fallback);
  }

  // Only call after reading or committing a durable owner state. A replacement
  // with a smaller map invalidates the old baseline and its dependent records.
  async function retainDurableAtlas(input: Input) {
    const key = keyFor(input), epoch = input.restoreEpoch;
    if (epoch === undefined || bases.get(key)?.epoch === epoch) return;
    const fence = generation(key);
    await enqueue(key, async () => {
      if (generation(key) !== fence || bases.get(key)?.epoch === epoch) return;
      const selected = await options.database.transaction(["meta"], "readwrite", async tx => {
        const previous = await tx.get<string>("meta", tokenKey(key));
        const legacy = await tx.get<LegacyRecord>("meta", key);
        if (previous && legacy?.atlasGeneration === previous) {
          const saved = await tx.get<StoredBase>("meta", baseKey(key));
          const atlas = matchingBase(saved, previous, input);
          if (atlas) {
            const head = await tx.get<MovementHead>("meta", headKey(key));
            return { base: { id: previous, atlas, epoch, lastMovement: head?.id }, obsolete: null };
          }
        }
        const id = crypto.randomUUID();
        const atlas = normalizeWildsExplorationAtlas(input.playState.explorationAtlas, rootPosition);
        await tx.put("meta", { id, keyId: input.keyId, actorId: input.actorId, atlas }, baseKey(key));
        await tx.put("meta", id, tokenKey(key));
        // Previous releases already delete this owner-scoped key on explicit
        // restore. Keep every byte of a complete legacy fallback if one exists.
        const witness = legacy?.schema === fallbackSchema ? legacy : { schema: witnessSchema };
        await tx.put("meta", { ...witness, atlasGeneration: id }, key);
        for (const entry of [movesKey(key), headKey(key), deltaKey(key)]) await tx.delete("meta", entry);
        return { base: { id, atlas, epoch }, obsolete: previous };
      });
      if (selected.obsolete) exitKeys(exitPrefix(key) + selected.obsolete + ":").forEach(removeLocal);
      if (generation(key) === fence) bases.set(key, selected.base);
    });
  }

  function prepare(input: Input) {
    const key = keyFor(input), fence = generation(key);
    const ticket = (issued.get(key) ?? 0) + 1;
    issued.set(key, ticket);
    const current = () => generation(key) === fence && issued.get(key) === ticket;
    const known = bases.get(key);
    const base = known && known.epoch === input.restoreEpoch ? known : null;
    const { checkpoint } = prepareWildzRuntimeCheckpoint(input);
    const { explorationAtlas: atlas, ...scalarState } = checkpoint.playState;
    const packet = base ? { ...checkpoint, schema: WILDZ_RUNTIME_MOVEMENT_SCHEMA, playState: scalarState } : checkpoint;
    let exitKey: string | undefined;

    function covers(interrupted: NonNullable<Base["interrupted"]>, movement: Pick<MovementHead, "pulse" | "breath">) {
      if (movement.pulse < interrupted.pulse || (movement.pulse === interrupted.pulse && movement.breath < interrupted.breath)) return false;
      return !hasDiscoveries(wildsExplorationCheckpointDelta(normalizeWildsExplorationAtlas(atlas, rootPosition), interrupted.atlas));
    }

    function saveExit(serialized: string) {
      if (!base || exitKey) return;
      const slot = exitPrefix(key) + base.id + ":" + crypto.randomUUID();
      const exit: Exit = { after: base.lastMovement ?? null, serialized, delta: additionsSinceCommit(base, atlas) };
      options.getStorage().setItem(slot, JSON.stringify(exit));
      exitKey = slot;
      const movement = { pulse: wildsPlayerLedgerPulse(input.playState), breath: input.playState.playerBreaths?.lastKaiUPulse ?? -1 };
      const interrupted = base.interrupted;
      if (interrupted && !covers(interrupted, movement)) {
        interrupted.keys.add(exitKey);
        interrupted.atlas = mergeWildsExplorationAtlases(interrupted.atlas, atlas);
        if (movement.pulse > interrupted.pulse || (movement.pulse === interrupted.pulse && movement.breath > interrupted.breath)) {
          interrupted.pulse = movement.pulse;
          interrupted.breath = movement.breath;
        }
      } else {
        if (interrupted) for (const old of interrupted.keys) if (old !== exitKey) removeLocal(old);
        base.interrupted = { keys: new Set([exitKey]), atlas: normalizeWildsExplorationAtlas(atlas, rootPosition), ...movement };
      }
    }

    async function commit(serialized: string) {
      if (!current()) return;
      if (!base) return writePrepared({ key, serialized });
      try {
        await enqueue(key, async () => {
          if (!current()) return;
          const movement: MovementHead = {
            id: crypto.randomUUID(),
            pulse: wildsPlayerLedgerPulse(input.playState),
            breath: input.playState.playerBreaths?.lastKaiUPulse ?? -1
          };
          const committed = await options.database.transaction(["meta"], "readwrite", async tx => {
            if (await tx.get<string>("meta", tokenKey(key)) !== base.id) return null;
            const prior = await tx.get<MovementHead>("meta", headKey(key));
            if (base.lastAtlas !== atlas) {
              const additions = additionsSinceCommit(base, atlas);
              if (hasDiscoveries(additions)) {
                const previous = await tx.get<WildsExplorationAtlas>("meta", deltaKey(key));
                await tx.put("meta", previous ? mergeWildsExplorationAtlases(previous, additions) : additions, deltaKey(key));
              }
            }
            if (prior && (prior.pulse > movement.pulse || (prior.pulse === movement.pulse && prior.breath > movement.breath))) {
              return prior.id;
            }
            await tx.put("meta", serialized, movesKey(key));
            await tx.put("meta", movement, headKey(key));
            return movement.id;
          });
          if (committed !== null) {
            base.lastAtlas = atlas;
            base.lastMovement = committed;
            if (current() && base.interrupted && covers(base.interrupted, movement)) {
              base.interrupted.keys.forEach(removeLocal);
              base.interrupted = undefined;
            }
          }
        });
      } catch {
        if (!current()) return;
        try { saveExit(serialized); } catch {
          writePreparedWildzRuntimeCheckpoint(options.getStorage(), { key, serialized: JSON.stringify(checkpoint) });
        }
      }
    }

    return { checkpoint: packet, commit, saveExit };
  }

  async function read(input: Input): Promise<PlayState> {
    const key = keyFor(input), fence = generation(key);
    const wantMovement = input.durableOwner && input.restoreEpoch !== undefined;
    const snapshot = await options.database.transaction(["meta"], "readonly", async tx => {
      const legacy = await tx.get<LegacyRecord>("meta", key);
      if (!wantMovement || !legacy?.atlasGeneration) return { legacy, saved: null };
      const id = await tx.get<string>("meta", tokenKey(key));
      if (!id || legacy.atlasGeneration !== id) return { legacy, saved: null };
      const [record, move, head, delta] = await Promise.all([
        tx.get<StoredBase>("meta", baseKey(key)), tx.get<string>("meta", movesKey(key)),
        tx.get<MovementHead>("meta", headKey(key)), tx.get<WildsExplorationAtlas>("meta", deltaKey(key))
      ]);
      return { legacy, saved: { id, record, move, head, delta } };
    }).catch(() => null);
    if (generation(key) !== fence) return input.playState;
    const legacy = await readLegacy(input, snapshot?.legacy ?? null);
    if (generation(key) !== fence) return input.playState;
    const saved = snapshot?.saved;
    if (!saved || input.restoreEpoch === undefined) return legacy;
    try {
      const atlas = matchingBase(saved.record, saved.id, input);
      if (!atlas) return legacy;
      const base: Base = { id: saved.id, atlas, epoch: input.restoreEpoch, lastMovement: saved.head?.id };
      bases.set(key, base);
      let state = legacy;
      function recover(serialized: string, delta: WildsExplorationAtlas | null, prefer: boolean) {
        const held = delta ? { ...state, explorationAtlas: mergeWildsExplorationAtlases(state.explorationAtlas, delta) } : state;
        const restored = readSerialized(serialized, { ...input, playState: held }, true);
        if (!restored) return false;
        state = prefer ? selectMovement(state, restored) : selectMovement(restored, state);
        return true;
      }
      if (saved.move && saved.head) recover(saved.move, saved.delta, true);
      const recovered = new Set<string>();
      for (const exitKey of exitKeys(exitPrefix(key) + saved.id + ":")) {
        try {
          const raw = options.getStorage().getItem(exitKey);
          if (raw) {
            const exit: Exit = JSON.parse(raw);
            if (recover(exit.serialized, exit.delta, exit.after === (saved.head?.id ?? null))) recovered.add(exitKey);
          }
        } catch { /* A malformed exit cannot erase an atomic IDB movement. */ }
      }
      if (recovered.size) base.interrupted = {
        keys: recovered, atlas: state.explorationAtlas,
        pulse: wildsPlayerLedgerPulse(state), breath: state.playerBreaths?.lastKaiUPulse ?? -1
      };
      return state;
    } catch { return legacy; }
  }

  function release(scope: Scope) {
    const key = keyFor(scope);
    generations.set(key, generation(key) + 1);
    bases.delete(key);
    issued.delete(key);
    fallbackKeys.delete(key);
  }

  function clear(scope: Scope) {
    const key = keyFor(scope);
    release(scope);
    removeLocal(key);
    exitKeys(exitPrefix(key)).forEach(removeLocal);
    return enqueue(key, () => options.database.transaction(["meta"], "readwrite", async tx => {
      for (const entry of [key, tokenKey(key), baseKey(key), movesKey(key), headKey(key), deltaKey(key)]) {
        await tx.delete("meta", entry);
      }
    }));
  }

  return {
    read, prepare, retainDurableAtlas, clear, release,
    write(input: Input) {
      const next = prepare(input);
      const serialized = JSON.stringify(next.checkpoint);
      try { next.saveExit(serialized); } catch { /* A full local cache still has the atomic IDB path. */ }
      return next.commit(serialized);
    }
  };
}
