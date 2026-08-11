import assert from "node:assert/strict";
import test from "node:test";
import { deriveKaiKlokMoment, deriveKaiKlokMomentFromUPulse } from "../src/features/play/kai-klok-moment";
import {
  assertCanonicalKaiTemporalRoot,
  compareKaiTemporalRoots,
  createKaiTemporalRoot,
  latestKaiTemporalRoot,
  verifyKaiTemporalRoot
} from "../src/features/play/kai-temporal-root";

test("an admitted native uPulse constructs the exact Kai moment without an ISO round-trip", () => {
  const exact = deriveKaiKlokMomentFromUPulse({ uPulse: 190, authority: "admitted" });
  const firstRepresentableMillisecond = deriveKaiKlokMoment({
    occurredAt: "2024-05-10T06:45:41.889Z",
    authority: "admitted"
  });

  assert.equal(exact.uPulse, 190);
  assert.equal(exact.pulse, 0);
  assert.equal(exact.percentIntoPulse, 0.00019);
  assert.equal(firstRepresentableMillisecond.uPulse, 191);
  assert.throws(
    () => deriveKaiKlokMomentFromUPulse({ uPulse: -1, authority: "admitted" }),
    /wilds_kai_moment_upulse_invalid/
  );
  assert.throws(
    () => deriveKaiKlokMomentFromUPulse({ uPulse: 190, authority: "forged" as never }),
    /wilds_kai_moment_authority_invalid/
  );
});

test("Kai uPulse is the primary temporal root and ISO metadata cannot reorder it", () => {
  const earlier = createKaiTemporalRoot(
    deriveKaiKlokMoment({ occurredAt: "2026-08-11T20:00:00.000Z", authority: "admitted" }),
    { sequence: 4, observedAt: "2099-01-01T00:00:00.000Z" }
  );
  const later = createKaiTemporalRoot(
    deriveKaiKlokMoment({ occurredAt: "2026-08-11T20:00:00.001Z", authority: "admitted" }),
    { sequence: 0, observedAt: "2000-01-01T00:00:00.000Z" }
  );

  assert.ok(later.uPulse > earlier.uPulse);
  assert.equal(compareKaiTemporalRoots(earlier, later), -1);
  assert.equal(latestKaiTemporalRoot(earlier, later), later);
});

test("causal sequence orders events sharing one uPulse", () => {
  const moment = deriveKaiKlokMoment({ occurredAt: "2026-08-11T20:00:00.000Z", authority: "world" });
  const first = createKaiTemporalRoot(moment, { sequence: 1 });
  const second = createKaiTemporalRoot(moment, { sequence: 2 });
  assert.equal(compareKaiTemporalRoots(first, second), -1);
  assert.equal(latestKaiTemporalRoot(first, second), second);
});

test("canonical mutation rejects local-only Kai authority", () => {
  const local = createKaiTemporalRoot(
    deriveKaiKlokMoment({ occurredAt: "2026-08-11T20:00:00.000Z", authority: "local" })
  );
  assert.throws(() => assertCanonicalKaiTemporalRoot(local), /wilds_kai_temporal_authority_invalid/);
});

test("Kai temporal roots reject forged authority and a coarse pulse inconsistent with uPulse", () => {
  const valid = createKaiTemporalRoot(
    deriveKaiKlokMomentFromUPulse({ uPulse: 1_000_001, authority: "world" }),
    { sequence: 3 }
  );
  assert.equal(verifyKaiTemporalRoot(valid), valid);
  assert.throws(
    () => verifyKaiTemporalRoot({ ...valid, authority: "forged" } as never),
    /wilds_kai_temporal_authority_invalid/
  );
  assert.throws(
    () => verifyKaiTemporalRoot({ ...valid, pulse: 99 }),
    /wilds_kai_temporal_pulse_invalid/
  );
});

test("non-identical Kai roots cannot silently share one causal slot", () => {
  const moment = deriveKaiKlokMomentFromUPulse({ uPulse: 77, authority: "admitted" });
  const left = createKaiTemporalRoot(moment, { sequence: 2, observedAt: "2026-08-11T20:00:00.000Z" });
  const same = createKaiTemporalRoot(moment, { sequence: 2, observedAt: "2000-01-01T00:00:00.000Z" });
  const conflict = { ...same, coordinate: `${same.coordinate}:conflict` };

  assert.equal(latestKaiTemporalRoot(left, same), left, "descriptive ISO metadata does not create a conflict");
  assert.throws(() => latestKaiTemporalRoot(left, conflict), /wilds_kai_temporal_slot_conflict/);
});
