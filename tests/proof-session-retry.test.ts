import assert from "node:assert/strict";
import { test } from "node:test";
import { proofSessionRetryDecision } from "../src/features/shell/proof-session-retry";

test("proof admission failures wait for an explicit reconnect trigger", () => {
  assert.deepEqual(
    proofSessionRetryDecision({ attempt: 1, online: true, code: "wildz_proof_admission_failed" }),
    { retry: false, delayMs: null }
  );
});

test("temporary proof failures back off and cap at one minute", () => {
  assert.deepEqual(
    proofSessionRetryDecision({ attempt: 0, online: true, code: "wildz_proof_challenge_unavailable" }),
    { retry: true, delayMs: 5_000 }
  );
  assert.deepEqual(
    proofSessionRetryDecision({ attempt: 9, online: true, code: "wildz_proof_challenge_unavailable" }),
    { retry: true, delayMs: 60_000 }
  );
});

test("offline proof failures wait for the browser online event", () => {
  assert.deepEqual(
    proofSessionRetryDecision({ attempt: 2, online: false, code: "wildz_proof_challenge_unavailable" }),
    { retry: false, delayMs: null }
  );
});
