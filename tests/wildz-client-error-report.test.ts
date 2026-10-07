import assert from "node:assert/strict";
import { test } from "node:test";
import { recordWildzClientError, WILDZ_CLIENT_ERROR_KEY } from "../src/lib/wildz/client-error-report";

test("client crash evidence stays bounded, omits URL credentials, and survives broken storage", () => {
  let saved = "invalid JSON";
  const storage = { getItem: () => saved, setItem: (key: string, value: string) => { assert.equal(key, WILDZ_CLIENT_ERROR_KEY); saved = value; } };
  for (let index = 0; index < 10; index++) {
    const error = new Error(`Crash ${index} at https://wildz.quest/api?token=private#credential`);
    error.stack = "frame https://wildz.quest/_next/chunk.js?token=private#credential\n" + "x".repeat(5000);
    recordWildzClientError(error, storage);
  }
  const records = JSON.parse(saved) as { message: string; stack: string }[];
  assert.equal(records.length, 4); assert.match(records[3]!.message, /Crash 9/);
  assert.equal(saved.includes("private"), false); assert.equal(saved.includes("credential"), false);
  assert.ok(records.every(record => record.stack.length <= 2400));
  const unavailable = { getItem(): string { throw Error("denied"); }, setItem() { throw Error("quota"); } };
  assert.equal(recordWildzClientError(new TypeError("Missing bed position"), unavailable).message, "Missing bed position");
  assert.equal(recordWildzClientError({ account: "must not serialize" }, storage).message, "Unexpected client error");
  assert.equal(saved.includes("must not serialize"), false);
  const hostile = new Error("bad error object");
  Object.defineProperty(hostile, "stack", { get() { throw Error("bad getter"); } });
  assert.equal(recordWildzClientError(hostile, storage).message, "Unexpected client error");
  const malformed = new Error(); Object.assign(malformed, { name: 42, message: null, stack: false });
  assert.equal(recordWildzClientError(malformed, storage).name, "Error");
});
