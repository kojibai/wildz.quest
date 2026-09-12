import assert from "node:assert/strict";
import { test } from "node:test";
import { createWildsSessionRestore } from "../src/features/play/wilds-session-restore";

test("startup and early building share recovery; repeated actions never replay it", async () => {
  let reads = 0;
  let release!: () => void;
  const ready = new Promise<void>(resolve => { release = resolve; });
  const restore = createWildsSessionRestore(async () => { reads++; await ready; });
  const startup = restore();
  const earlyBuild = restore();
  assert.equal(startup, earlyBuild);
  await Promise.resolve();
  assert.equal(reads, 1);
  release();
  await earlyBuild;
  for (let i = 0; i < 100; i++) await restore();
  assert.equal(reads, 1);
});

test("failed recovery retries and different sessions recover independently", async () => {
  let reads = 0;
  const restore = createWildsSessionRestore(async () => { if (++reads === 1) throw new Error("storage"); });
  await assert.rejects(restore(), /storage/);
  await restore();
  await restore();
  assert.equal(reads, 2);
  await createWildsSessionRestore(async () => { reads++; })();
  assert.equal(reads, 3);
});
