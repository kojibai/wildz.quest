import assert from "node:assert/strict";
import { test } from "node:test";
import { createReceizIdIdentity, projectReceizIdentityAccount } from "@receiz/sdk";
import type { WildzCharacterGenesis } from "../src/features/identity/wildz-genesis";
import { WILDZ_IDENTITY_STORAGE_KEY } from "../src/features/identity/wildz-identity";
import { initialPlayState } from "../src/features/play/game-state";
import { createNamedWildzIdentity } from "../src/lib/receiz/wildz-identity-adapter";
import type { WildzContinuityDatabase } from "../src/lib/storage/wildz-indexed-db";
import {
  canonicalWildzActorId,
  createWildzAutomaticUsername,
  createWildzIdentityRepository,
  wildzOwnerScope
} from "../src/lib/receiz/wildz-identity-repository";
import { createMemoryWildzContinuityDatabase } from "./support/memory-wildz-continuity-database";

function deferred() {
  let resolve!: () => void;
  const promise = new Promise<void>((done) => { resolve = done; });
  return { promise, resolve };
}

function memoryLegacyStorage(raw: string, onRemove?: () => void) {
  const values = new Map([[WILDZ_IDENTITY_STORAGE_KEY, raw]]);
  return {
    storage: {
      getItem: (key: string) => values.get(key) ?? null,
      removeItem: (key: string) => {
        onRemove?.();
        values.delete(key);
      }
    },
    value: () => values.get(WILDZ_IDENTITY_STORAGE_KEY) ?? null
  };
}

test("actor ID prefers normalized username and falls back to UID", async () => {
  const identity = await createReceizIdIdentity({ username: "@Fern.Path", displayName: "Fern" });
  const projection = await projectReceizIdentityAccount(identity.keyFile);
  assert.equal(canonicalWildzActorId(projection), "fern_path");
  assert.equal(canonicalWildzActorId({ ...identity.keyFile, owner: { ...identity.keyFile.owner, username: null, uid: " Receiz:UID_7 " } }), "receiz:uid_7");
});

test("a chosen SDK username replaces only an untouched automatic identity", async () => {
  const database = createMemoryWildzContinuityDatabase();
  const repository = createWildzIdentityRepository({ database });
  const automatic = await repository.bootstrap();
  const current = {
    session: automatic,
    playState: null,
    character: null,
    playerContinuity: null,
    restoreEpoch: 0
  };
  const named = await createNamedWildzIdentity(
    current,
    { username: "@Trail_Keeper", displayName: "Trail Keeper" },
    { database, repository }
  );

  assert.equal(named.session.username, "trail_keeper");
  assert.equal(named.session.actorId, "trail_keeper");
  assert.equal(named.session.portableStateStatus, "verified");
  assert.deepEqual(await repository.active(), named.session);
  assert.equal(await database.read("ownerStates", wildzOwnerScope(automatic.keyId, automatic.actorId)), null);

  await assert.rejects(
    createNamedWildzIdentity(
      { ...named, playState: structuredClone(initialPlayState) },
      { username: "second_name" },
      { database, repository }
    ),
    /wildz_identity_username_change_not_fresh/
  );
  await assert.rejects(
    createNamedWildzIdentity(
      { ...named, character: { identityRef: named.session.keyId } as unknown as WildzCharacterGenesis },
      { username: "third_name" },
      { database, repository }
    ),
    /wildz_identity_username_change_not_fresh/
  );
});

test("owner scopes encode both authority coordinates", () => {
  assert.equal(
    wildzOwnerScope("rz:key/one", "Fern Path"),
    "wildz:rz%3Akey%2Fone:Fern%20Path"
  );
});

test("automatic local identities use a canonical cross-platform player coordinate", () => {
  const username = createWildzAutomaticUsername();
  assert.match(username, /^wildz_[a-f0-9]{16}$/);
  assert.match(username, /^[a-z0-9_]{3,24}$/);
});

test("protected persistence contains no serialized private authority", async () => {
  const database = createMemoryWildzContinuityDatabase();
  const repository = createWildzIdentityRepository({ database });
  const session = await repository.bootstrap();
  const dump = JSON.stringify(database.dump());
  assert.equal(session.localAuthority, "verified");
  assert.doesNotMatch(dump, /privateKeyPkcs8B64u|privateKeyPkcs8CiphertextB64u|receiz\.key\.v1/);
  assert.equal(database.wrappingKey().extractable, false);
  assert.deepEqual(await repository.active(), session);
  assert.equal(
    await repository.withKeyFile(session.keyId, async (keyFile) => keyFile.keyId),
    session.keyId
  );
});

test("prepared identities can be stored without activation and activated later", async () => {
  const database = createMemoryWildzContinuityDatabase();
  const repository = createWildzIdentityRepository({ database });
  const identity = await createReceizIdIdentity({ username: "switch_test", displayName: "Switch Test" });
  const prepared = await repository.prepare(identity.keyFile);

  await database.transaction(["identities", "ownerStates", "meta"], "readwrite", async (tx) => {
    await repository.writePrepared(tx, prepared, false);
  });
  assert.equal(await repository.active(), null);
  assert.equal(
    await repository.withKeyFile(prepared.session.keyId, async (keyFile) => keyFile.owner.username),
    "switch_test"
  );

  await database.transaction(["identities", "ownerStates", "meta"], "readwrite", async (tx) => {
    await repository.writePrepared(tx, prepared, true);
  });
  assert.deepEqual(await repository.active(), prepared.session);

  await repository.logout();
  assert.equal(await repository.active(), null);
  assert.equal(
    await repository.withKeyFile(prepared.session.keyId, async (keyFile) => keyFile.keyId),
    prepared.session.keyId
  );
});

test("remote-only Vault identities survive an offline session recheck without becoming local key authority", async () => {
  const database = createMemoryWildzContinuityDatabase();
  const repository = createWildzIdentityRepository({ database });
  const session = {
    schema: "receiz.wildz.identity_session.v1",
    keyId: "receiz_remote_subject_key",
    actorId: "vault_keeper",
    username: "vault_keeper",
    displayName: "Vault Keeper",
    portableStateStatus: "missing",
    localAuthority: "remote-only",
    remoteStatus: "offline"
  } as const;

  await database.transaction(["meta"], "readwrite", (tx) => repository.writeSession(tx, session, true));

  assert.deepEqual(await repository.active(), session);
  await assert.rejects(repository.withKeyFile(session.keyId, async () => undefined), /wildz_identity_not_found/);
});

test("legacy migration is durable before plaintext storage is removed", async () => {
  const database = createMemoryWildzContinuityDatabase();
  const repository = createWildzIdentityRepository({ database });
  const identity = await createReceizIdIdentity({ username: "legacy_test", displayName: "Legacy Test" });
  const raw = JSON.stringify({ version: 1, savedAt: identity.createdAt, identity });
  const legacy = memoryLegacyStorage(raw, () => {
    assert.equal(database.legacyMigrationMarker()?.keyId, identity.keyFile.keyId);
    assert.equal(database.activePointer()?.keyId, identity.keyFile.keyId);
  });

  const session = await repository.bootstrap(legacy.storage);

  assert.equal(session.keyId, identity.keyFile.keyId);
  assert.equal(legacy.value(), null);
});

test("failed legacy migration preserves plaintext source and prior active pointer", async () => {
  const database = createMemoryWildzContinuityDatabase();
  const repository = createWildzIdentityRepository({ database });
  const prior = await repository.bootstrap();
  const priorPointer = database.activePointer();
  const identity = await createReceizIdIdentity({ username: "legacy_next", displayName: "Legacy Next" });
  const raw = JSON.stringify({ version: 1, savedAt: identity.createdAt, identity });
  const legacy = memoryLegacyStorage(raw);
  database.failNextTransaction(new Error("wildz_test_transaction_failed"));

  await assert.rejects(repository.bootstrap(legacy.storage), /wildz_test_transaction_failed/);

  assert.equal(legacy.value(), raw);
  assert.deepEqual(database.activePointer(), priorPointer);
  assert.deepEqual(await repository.active(), prior);
});

test("invalid portable identity state is never admitted as verified local authority", async () => {
  const database = createMemoryWildzContinuityDatabase();
  const repository = createWildzIdentityRepository({ database });
  const identity = await createReceizIdIdentity({ username: "tampered_state", displayName: "Tampered State" });
  const keyFile = structuredClone(identity.keyFile);
  assert.ok(keyFile.portableState);
  assert.ok(keyFile.portableState.proof);
  keyFile.portableState.proof.signatureB64u = `${
    keyFile.portableState.proof.signatureB64u.startsWith("A") ? "B" : "A"
  }${keyFile.portableState.proof.signatureB64u.slice(1)}`;
  assert.equal((await projectReceizIdentityAccount(keyFile)).portableStateStatus, "invalid");

  await assert.rejects(repository.prepare(keyFile), /wildz_identity_portable_state_invalid/);
  assert.equal(database.dump().identities.length, 0);
});

test("concurrent bootstrap calls converge on one active identity", async () => {
  const database = createMemoryWildzContinuityDatabase();
  const firstRepository = createWildzIdentityRepository({ database });
  const secondRepository = createWildzIdentityRepository({ database });

  const [first, second] = await Promise.all([
    firstRepository.bootstrap(),
    secondRepository.bootstrap()
  ]);

  assert.deepEqual(second, first);
  assert.deepEqual(await firstRepository.active(), first);
  assert.equal(
    await secondRepository.withKeyFile(first.keyId, async (keyFile) => keyFile.keyId),
    first.keyId
  );
});

test("concurrent bootstrap calls for the same legacy source converge after one removes storage", async () => {
  const database = createMemoryWildzContinuityDatabase();
  const firstRepository = createWildzIdentityRepository({ database });
  const secondRepository = createWildzIdentityRepository({ database });
  const identity = await createReceizIdIdentity({ username: "legacy_concurrent", displayName: "Legacy Concurrent" });
  const raw = JSON.stringify({ version: 1, savedAt: identity.createdAt, identity });
  let removals = 0;
  const legacy = memoryLegacyStorage(raw, () => { removals += 1; });

  const firstBootstrap = firstRepository.bootstrap(legacy.storage);
  const secondBootstrap = secondRepository.bootstrap(legacy.storage);
  const [first, second] = await Promise.all([firstBootstrap, secondBootstrap]);

  assert.deepEqual(second, first);
  assert.equal(first.keyId, identity.keyFile.keyId);
  assert.deepEqual(await firstRepository.active(), first);
  assert.equal(legacy.value(), null);
  assert.equal(removals, 1);
});

test("a migration marker never deletes a different legacy identity", async () => {
  const database = createMemoryWildzContinuityDatabase();
  const repository = createWildzIdentityRepository({ database });
  const first = await createReceizIdIdentity({ username: "legacy_first", displayName: "Legacy First" });
  const second = await createReceizIdIdentity({ username: "legacy_second", displayName: "Legacy Second" });
  const firstRaw = JSON.stringify({ version: 1, savedAt: first.createdAt, identity: first });
  const secondRaw = JSON.stringify({ version: 1, savedAt: second.createdAt, identity: second });
  let raw: string | null = firstRaw;
  let preserveFirstRemoval = true;
  const storage = {
    getItem: (key: string) => key === WILDZ_IDENTITY_STORAGE_KEY ? raw : null,
    removeItem: (key: string) => {
      if (key !== WILDZ_IDENTITY_STORAGE_KEY) return;
      if (preserveFirstRemoval) preserveFirstRemoval = false;
      else raw = null;
    }
  };

  await repository.bootstrap(storage);
  assert.equal(raw, firstRaw);
  raw = secondRaw;

  await assert.rejects(repository.bootstrap(storage), /wildz_identity_legacy_source_mismatch/);
  assert.equal(raw, secondRaw);
});

test("active identity resolves through one readonly transaction", async () => {
  const database = createMemoryWildzContinuityDatabase();
  const seeded = await createWildzIdentityRepository({ database }).bootstrap();
  const transactionOnlyDatabase: WildzContinuityDatabase = {
    read: async () => {
      throw new Error("wildz_test_non_atomic_read");
    },
    transaction: database.transaction.bind(database)
  };

  assert.deepEqual(
    await createWildzIdentityRepository({ database: transactionOnlyDatabase }).active(),
    seeded
  );
});

test("persisted wrapping keys must be non-extractable AES-GCM-256 keys", async () => {
  const database = createMemoryWildzContinuityDatabase();
  await createWildzIdentityRepository({ database }).bootstrap();
  const wrappingKeyId = database.dump().wrappingKeys[0]?.[0];
  assert.ok(wrappingKeyId);
  const weakKey = await crypto.subtle.generateKey(
    { name: "AES-GCM", length: 128 },
    false,
    ["encrypt", "decrypt"]
  );
  await database.transaction(["wrappingKeys"], "readwrite", async (tx) => {
    await tx.put("wrappingKeys", weakKey, wrappingKeyId);
  });
  const identity = await createReceizIdIdentity({ username: "strong_wrap", displayName: "Strong Wrap" });

  await assert.rejects(
    createWildzIdentityRepository({ database }).prepare(identity.keyFile),
    /wildz_identity_wrapping_key_invalid/
  );
});

test("an in-flight legacy migration never removes replacement identity bytes", async () => {
  const memory = createMemoryWildzContinuityDatabase();
  const transactionCommitted = deferred();
  const releaseBootstrap = deferred();
  let interceptIdentityCommit = true;
  const database: WildzContinuityDatabase = {
    read: memory.read.bind(memory),
    async transaction(stores, mode, operation) {
      const result = await memory.transaction(stores, mode, operation);
      if (interceptIdentityCommit && mode === "readwrite" && stores.includes("identities") && stores.includes("meta")) {
        interceptIdentityCommit = false;
        transactionCommitted.resolve();
        await releaseBootstrap.promise;
      }
      return result;
    }
  };
  const repository = createWildzIdentityRepository({ database });
  const first = await createReceizIdIdentity({ username: "inflight_first", displayName: "Inflight First" });
  const replacement = await createReceizIdIdentity({ username: "inflight_replacement", displayName: "Inflight Replacement" });
  const firstRaw = JSON.stringify({ version: 1, savedAt: first.createdAt, identity: first });
  const replacementRaw = JSON.stringify({ version: 1, savedAt: replacement.createdAt, identity: replacement });
  let raw: string | null = firstRaw;
  let removals = 0;
  const storage = {
    getItem: (key: string) => key === WILDZ_IDENTITY_STORAGE_KEY ? raw : null,
    removeItem: (key: string) => {
      if (key === WILDZ_IDENTITY_STORAGE_KEY) {
        removals += 1;
        raw = null;
      }
    }
  };

  const bootstrap = repository.bootstrap(storage);
  await transactionCommitted.promise;
  raw = replacementRaw;
  releaseBootstrap.resolve();

  await assert.rejects(bootstrap, /wildz_identity_legacy_source_mismatch/);
  assert.equal(raw, replacementRaw);
  assert.equal(removals, 0);
  assert.equal((await repository.active())?.keyId, first.keyFile.keyId);
});

test("legacy marker pointer and session verification uses one database snapshot", async () => {
  const memory = createMemoryWildzContinuityDatabase();
  let splitMarkerRead = false;
  const database: WildzContinuityDatabase = {
    async read<T>(store: Parameters<WildzContinuityDatabase["read"]>[0], key: IDBValidKey) {
      const value = await memory.read<T>(store, key);
      if (value && typeof value === "object" && "schema" in value && value.schema === "receiz.wildz.legacy_identity_migration.v1") {
        splitMarkerRead = true;
        const meta = memory.dump().meta;
        const sessionEntry = meta.find(([, item]) => item && typeof item === "object" && "schema" in item && item.schema === "receiz.wildz.identity_session.v1");
        const pointerEntry = meta.find(([, item]) => item && typeof item === "object" && "schema" in item && item.schema === "receiz.wildz.active_identity.v1");
        assert.ok(sessionEntry);
        assert.ok(pointerEntry);
        const session = sessionEntry[1] as { keyId: string };
        const actorId = "interleaved_actor";
        await memory.transaction(["meta"], "readwrite", async (tx) => {
          await tx.put("meta", { ...sessionEntry[1] as object, actorId }, sessionEntry[0]);
          await tx.put("meta", {
            ...pointerEntry[1] as object,
            actorId,
            ownerScope: wildzOwnerScope(session.keyId, actorId)
          }, pointerEntry[0]);
        });
      }
      return value;
    },
    transaction: memory.transaction.bind(memory)
  };
  const repository = createWildzIdentityRepository({ database });
  const identity = await createReceizIdIdentity({ username: "snapshot_test", displayName: "Snapshot Test" });
  const raw = JSON.stringify({ version: 1, savedAt: identity.createdAt, identity });
  const legacy = memoryLegacyStorage(raw);

  const session = await repository.bootstrap(legacy.storage);

  assert.equal(session.actorId, "snapshot_test");
  assert.equal(splitMarkerRead, false);
});

test("writePrepared rejects a prepared session mutated to invalid", async () => {
  const database = createMemoryWildzContinuityDatabase();
  const repository = createWildzIdentityRepository({ database });
  const identity = await createReceizIdIdentity({ username: "mutated_write", displayName: "Mutated Write" });
  const prepared = await repository.prepare(identity.keyFile);
  prepared.session.portableStateStatus = "invalid";
  const before = database.dump();

  await assert.rejects(
    database.transaction(["identities", "meta"], "readwrite", (tx) => repository.writePrepared(tx, prepared, true)),
    /wildz_identity_prepared_record_invalid/
  );
  assert.deepEqual(database.dump(), before);
  assert.equal(await repository.active(), null);
});

test("writePrepared snapshots admission before asynchronous writes", async () => {
  const database = createMemoryWildzContinuityDatabase();
  const repository = createWildzIdentityRepository({ database });
  const identity = await createReceizIdIdentity({ username: "mutated_inflight", displayName: "Mutated Inflight" });
  const prepared = await repository.prepare(identity.keyFile);
  const firstPutReached = deferred();
  const releaseFirstPut = deferred();
  let firstPut = true;

  const write = database.transaction(["identities", "meta"], "readwrite", (tx) => repository.writePrepared({
    get: tx.get.bind(tx),
    getAll: tx.getAll.bind(tx),
    async put(store, value, key) {
      if (firstPut) {
        firstPut = false;
        firstPutReached.resolve();
        await releaseFirstPut.promise;
      }
      await tx.put(store, value, key);
    },
    delete: tx.delete.bind(tx)
  }, prepared, true));

  await firstPutReached.promise;
  prepared.session.portableStateStatus = "invalid";
  releaseFirstPut.resolve();
  await write;

  const active = await repository.active();
  assert.ok(active);
  assert.equal(active.portableStateStatus, "verified");
});

test("active rejects a stored session mutated to invalid", async () => {
  const database = createMemoryWildzContinuityDatabase();
  const repository = createWildzIdentityRepository({ database });
  await repository.bootstrap();
  const sessionEntry = database.dump().meta.find(([, item]) => item && typeof item === "object" && "schema" in item && item.schema === "receiz.wildz.identity_session.v1");
  assert.ok(sessionEntry);
  await database.transaction(["meta"], "readwrite", async (tx) => {
    await tx.put("meta", { ...sessionEntry[1] as object, portableStateStatus: "invalid" }, sessionEntry[0]);
  });

  assert.equal(await repository.active(), null);
});

test("partial legacy writes roll back identity session pointer and marker", async () => {
  const database = createMemoryWildzContinuityDatabase();
  const repository = createWildzIdentityRepository({ database });
  const prior = await repository.bootstrap();
  const before = database.dump();
  const identity = await createReceizIdIdentity({ username: "partial_write", displayName: "Partial Write" });
  const raw = JSON.stringify({ version: 1, savedAt: identity.createdAt, identity });
  const legacy = memoryLegacyStorage(raw);
  database.failNextTransactionAfterPuts(2, new Error("wildz_test_partial_write_failed"));

  await assert.rejects(repository.bootstrap(legacy.storage), /wildz_test_partial_write_failed/);

  assert.equal(legacy.value(), raw);
  assert.deepEqual(database.dump(), before);
  assert.deepEqual(await repository.active(), prior);
});

test("persisted wrapping keys reject wrong algorithm extractability and extra usages", async () => {
  const database = createMemoryWildzContinuityDatabase();
  await createWildzIdentityRepository({ database }).bootstrap();
  const wrappingKeyId = database.dump().wrappingKeys[0]?.[0];
  assert.ok(wrappingKeyId);
  const rejectedKeys = [
    await crypto.subtle.generateKey({ name: "AES-CBC", length: 256 }, false, ["encrypt", "decrypt"]),
    await crypto.subtle.generateKey({ name: "AES-GCM", length: 256 }, true, ["encrypt", "decrypt"]),
    await crypto.subtle.generateKey({ name: "AES-GCM", length: 256 }, false, ["encrypt", "decrypt", "wrapKey"])
  ];
  const identity = await createReceizIdIdentity({ username: "exact_usage", displayName: "Exact Usage" });

  for (const key of rejectedKeys) {
    await database.transaction(["wrappingKeys"], "readwrite", async (tx) => {
      await tx.put("wrappingKeys", key, wrappingKeyId);
    });
    await assert.rejects(
      createWildzIdentityRepository({ database }).prepare(identity.keyFile),
      /wildz_identity_wrapping_key_invalid/
    );
  }
});
