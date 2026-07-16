import assert from "node:assert/strict";
import { test } from "node:test";
import {
  createWildzPendingVaultRepository,
  MAX_WILDZ_PENDING_VAULT_BYTES,
  MAX_WILDZ_PENDING_VAULT_RECORDS,
  type WildzPendingVaultRestore
} from "../src/lib/receiz/wildz-pending-vault";
import { createMemoryWildzContinuityDatabase } from "./support/memory-wildz-continuity-database";

const PLAYER = { actorId: "vault_keeper", profileHandle: "vault_keeper.receiz.id" } as const;
const BASIS = "a".repeat(64);

test("pending Vault staging uses opaque IDs and round-trips exact bytes outside meta", async () => {
  const database = createMemoryWildzContinuityDatabase();
  const pending = createWildzPendingVaultRepository({ database, now: () => 1_000 });
  const bytes = new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10, 1, 2, 3]);

  const staged = await pending.stage({
    surface: "genesis",
    bytes,
    mimeType: "image/png",
    name: "../unsafe/<vault>.receized.png",
    player: PLAYER,
    proofBasisSha256: BASIS
  });

  assert.match(staged.resumeId, /^[A-Za-z0-9_-]{22,}$/);
  assert.equal(staged.createdAtMs, 1_000);
  assert.equal(staged.expiresAtMs, 901_000);
  assert.equal(staged.name?.includes("/") ?? false, false);
  assert.deepEqual((await pending.load(staged.resumeId))?.bytes, bytes);
  assert.equal(staged.byteDigestSha256.length, 64);
  assert.equal(database.dump().pendingRestores.length, 1);
  assert.equal(database.dump().meta.some(([, value]) => value instanceof Uint8Array), false);
});

test("expired pending Vaults delete on load, purge, and malformed records fail closed", async () => {
  let now = 5_000;
  const database = createMemoryWildzContinuityDatabase();
  const pending = createWildzPendingVaultRepository({ database, now: () => now });
  const staged = await pending.stage({
    surface: "card-vault",
    bytes: new Uint8Array([1, 2, 3]),
    mimeType: "image/png",
    name: null,
    player: PLAYER,
    proofBasisSha256: BASIS
  });
  now = staged.expiresAtMs + 1;
  assert.equal(await pending.load(staged.resumeId), null);
  assert.equal(database.dump().pendingRestores.length, 0);
  assert.equal(await pending.purgeExpired(), 0);
  assert.equal(database.dump().pendingRestores.length, 0);

  const malformed = {
    ...staged,
    resumeId: "malformed-record",
    bytes: "not-bytes"
  } as unknown as WildzPendingVaultRestore;
  await database.transaction(["pendingRestores"], "readwrite", (tx) =>
    tx.put("pendingRestores", malformed, malformed.resumeId)
  );
  await assert.rejects(pending.load(malformed.resumeId), /wildz_pending_vault_invalid/);
});

test("pending Vault staging caps retained records and evicts the oldest safely", async () => {
  let now = 20_000;
  const database = createMemoryWildzContinuityDatabase();
  const pending = createWildzPendingVaultRepository({ database, now: () => now });
  const ids: string[] = [];

  for (let index = 0; index < MAX_WILDZ_PENDING_VAULT_RECORDS + 2; index += 1) {
    const staged = await pending.stage({
      surface: "genesis",
      bytes: new Uint8Array([index + 1]),
      mimeType: "image/png",
      name: `vault-${index}.png`,
      player: PLAYER,
      proofBasisSha256: BASIS
    });
    ids.push(staged.resumeId);
    now += 1;
  }

  assert.equal(database.dump().pendingRestores.length, MAX_WILDZ_PENDING_VAULT_RECORDS);
  assert.equal(await pending.load(ids[0]), null);
  assert.equal(await pending.load(ids[1]), null);
  assert.ok(await pending.load(ids.at(-1)!));
});

test("a failed pending-Vault transaction preserves the previously staged record", async () => {
  const database = createMemoryWildzContinuityDatabase();
  const pending = createWildzPendingVaultRepository({ database, now: () => 10_000 });
  const first = await pending.stage({
    surface: "genesis",
    bytes: new Uint8Array([9, 8, 7]),
    mimeType: "image/png",
    name: "first.png",
    player: PLAYER,
    proofBasisSha256: BASIS
  });
  database.failNextTransaction(new Error("injected_pending_failure"));
  await assert.rejects(pending.stage({
    surface: "genesis",
    bytes: new Uint8Array([6, 5, 4]),
    mimeType: "image/png",
    name: "second.png",
    player: PLAYER,
    proofBasisSha256: BASIS
  }), /injected_pending_failure/);
  assert.deepEqual((await pending.load(first.resumeId))?.bytes, new Uint8Array([9, 8, 7]));
  assert.equal(database.dump().pendingRestores.length, 1);
});

test("pending Vault staging rejects bytes beyond the 64 MiB artifact boundary before persistence", async () => {
  const database = createMemoryWildzContinuityDatabase();
  const pending = createWildzPendingVaultRepository({ database });
  await assert.rejects(pending.stage({
    surface: "genesis",
    bytes: new Uint8Array(MAX_WILDZ_PENDING_VAULT_BYTES + 1),
    mimeType: "image/png",
    name: "oversized.png",
    player: PLAYER,
    proofBasisSha256: BASIS
  }), /wildz_pending_vault_size_invalid/);
  assert.equal(database.dump().pendingRestores.length, 0);
});
