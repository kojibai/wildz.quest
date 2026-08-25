import assert from "node:assert/strict";
import test from "node:test";
import { deriveKaiKlokMoment } from "../src/features/play/kai-klok-moment";
import { canonicalPortableCardJson } from "../src/features/play/portable-card";
import { admitWildsGroveAction, previewWildsGroveAction } from "../src/features/play/wilds-regenerative-grove";
import { admitWildsEmissionOutcome } from "../src/features/play/wilds-world-emission";
import { WildsWorldService } from "../src/features/play/wilds-world-service";

const PULSE = "2026-07-15T00:00:00.000Z";

function genesis() {
  const service = new WildsWorldService();
  service.tick({ pulse: PULSE, occurredAt: PULSE, systemActorId: "receiz:pulse" });
  service.tickEcology({ pulse: PULSE, occurredAt: PULSE, systemActorId: "receiz:pulse" });
  service.tickGroves({ pulse: PULSE, occurredAt: PULSE, systemActorId: "receiz:pulse" });
  return service;
}

function observe(service: WildsWorldService, actorId: string, actorHead: string, commandId: string) {
  const grove = Object.values(service.snapshot().groves)[0]!;
  const emission = service.snapshot().worldEmission!;
  const moment = deriveKaiKlokMoment({ occurredAt: PULSE, authority: "world" });
  const preview = previewWildsGroveAction({
    grove, action: "observe", actor: { id: actorId, head: actorHead },
    weather: grove.weather, moment, emission
  });
  return {
    command: {
      type: "grove.act" as const,
      operation: preview.operation,
      grove: admitWildsGroveAction({ grove, preview }),
      emission: admitWildsEmissionOutcome({ emission, operation: preview.operation, contributionClass: "ecology", preview: preview.emission }),
      amountPhiMicro: preview.emission.amountPhiMicro,
      commandId
    },
    authority: { actorId, canonical: true, pulse: PULSE, occurredAt: PULSE, uPulse: moment.uPulse } as const
  };
}

test("two clients converge byte-for-byte and a competing stale Grove head writes nothing", () => {
  const source = genesis();
  const checkpoint = source.checkpoint();
  const first = observe(source, "player:one", "a".repeat(64), "grove:observe:one");
  const stale = observe(source, "player:two", "b".repeat(64), "grove:observe:two");
  const canonical = new WildsWorldService({ checkpoint });
  canonical.execute(first.command, first.authority);
  const revision = canonical.snapshot().revision;

  assert.throws(() => canonical.execute(stale.command, stale.authority), /wilds_world_grove_operation_invalid/);
  assert.equal(canonical.snapshot().revision, revision);

  const peerA = new WildsWorldService({ checkpoint });
  const peerB = new WildsWorldService({ checkpoint });
  peerA.execute(first.command, first.authority);
  peerB.execute(first.command, first.authority);
  assert.equal(canonicalPortableCardJson(peerA.snapshot()), canonicalPortableCardJson(peerB.snapshot()));
});
