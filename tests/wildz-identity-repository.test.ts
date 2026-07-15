import assert from "node:assert/strict";
import { test } from "node:test";
import { createReceizIdIdentity, projectReceizIdentityAccount } from "@receiz/sdk";
import { WILDZ_IDENTITY_STORAGE_KEY } from "../src/features/identity/wildz-identity";
import type { WildzContinuityDatabase } from "../src/lib/storage/wildz-indexed-db";
import {
  canonicalWildzActorId,
  createWildzIdentityRepository,
  wildzOwnerScope
} from "../src/lib/receiz/wildz-identity-repository";
import { createMemoryWildzContinuityDatabase } from "./support/memory-wildz-continuity-database";

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

test("owner scopes encode both authority coordinates", () => {
  assert.equal(
    wildzOwnerScope("rz:key/one", "Fern Path"),
    "wildz:rz%3Akey%2Fone:Fern%20Path"
  );
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
  keyFile.portableState.snapshot = { schema: "receiz.device.identity.v1", tampered: true };
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
