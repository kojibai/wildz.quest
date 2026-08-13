import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { deriveKaiKlokMomentFromUPulse } from "../src/features/play/kai-klok-moment";
import { createKaiTemporalRoot } from "../src/features/play/kai-temporal-root";
import {
  verifyWildsWorldCommandKai,
  withWildsWorldCommandKai
} from "../src/features/play/wilds-world-authority";

describe("Wilds world Kai command authority", () => {
  const moment = deriveKaiKlokMomentFromUPulse({ uPulse: 8_765_432_100, authority: "local" });
  const kai = createKaiTemporalRoot(moment, { observedAt: "2026-08-13T12:00:00.000Z" });

  it("preserves the exact runtime uPulse on a gameplay command", () => {
    const command = withWildsWorldCommandKai({
      type: "raid.join",
      bossId: "boss:one",
      commandId: "command:raid:one"
    }, kai);

    assert.equal(command.kai.uPulse, 8_765_432_100);
    assert.equal(verifyWildsWorldCommandKai(command), kai);
  });

  it("rejects missing or malformed command roots instead of substituting server time", () => {
    const command = { type: "raid.join", bossId: "boss:one", commandId: "command:raid:one" } as const;
    assert.throws(() => verifyWildsWorldCommandKai(command), /wilds_world_kai_root_required/);
    assert.throws(
      () => verifyWildsWorldCommandKai({ ...command, kai: { ...kai, uPulse: -1 } }),
      /wilds_kai_temporal_upulse_invalid/
    );
  });
});
