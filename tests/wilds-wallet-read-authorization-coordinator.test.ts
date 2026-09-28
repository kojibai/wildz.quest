import assert from "node:assert/strict";
import { test } from "node:test";
import { createWildsWalletReadAuthorizationCoordinator } from "../src/features/play/wallet/wilds-wallet-read-authorization-coordinator";

test("card-upload renewal joins the unfinished wallet ticket exchange", async () => {
  const coordinate = createWildsWalletReadAuthorizationCoordinator();
  let release!: () => void;
  const wait = new Promise<void>(resolve => { release = resolve; });
  let ticket = "";
  let starts = 0;
  const authorize = async () => {
    starts++;
    ticket = `ticket-${starts}`;
    const issued = ticket;
    await wait;
    assert.equal(ticket, issued);
    ticket = "";
    return true;
  };
  const beforeUpload = coordinate("owner:wallet-read", authorize);
  await Promise.resolve();
  const afterUpload = coordinate("owner:wallet-read", authorize);
  assert.equal(beforeUpload, afterUpload);
  const another = coordinate("other:wallet-read", authorize);
  assert.equal(starts, 1);
  release();
  assert.deepEqual(await Promise.all([beforeUpload, afterUpload, another]), [true, true, true]);
  assert.equal(starts, 2);
  await coordinate("owner:wallet-read", authorize);
  assert.equal(starts, 3);
});

test("a rejected exchange releases the lane for retry", async () => {
  const coordinate = createWildsWalletReadAuthorizationCoordinator();
  await assert.rejects(coordinate("owner", async () => { throw new Error("ticket_expired"); }), /ticket_expired/);
  assert.equal(await coordinate("owner", async () => true), true);
});
