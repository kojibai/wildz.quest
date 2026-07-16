import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { WildsWorldService } from "../src/features/play/wilds-world-service.js";

const at = "2026-07-20T12:00:00.000Z";
const auth = (actorId = "player:captain") => ({ actorId, canonical: true, pulse: at, occurredAt: at });

describe("Slice 5 world social wiring", () => {
  it("persists invites and accepted members through proof-safe world events", () => {
    const world = new WildsWorldService();
    world.execute({ type: "team.create", name: "Rift Walkers", commandId: "team:create:1" }, auth());
    const team = Object.values(world.snapshot().teams)[0]!;
    world.execute({ type: "team.invite", teamId: team.id, inviteeId: "player:friend", expiresAt: "2026-07-21T12:00:00.000Z", commandId: "team:invite:1" }, auth());
    const invite = world.snapshot().teams[team.id]!.invites?.[0]!;
    world.execute({ type: "team.invite.accept", teamId: team.id, inviteId: invite.id, commandId: "team:accept:1" }, auth("player:friend"));
    assert.ok(world.snapshot().teams[team.id]!.memberIds.includes("player:friend"));
  });

  it("schedules events, assembles squads, and queues abuse reports", () => {
    const world = new WildsWorldService();
    world.execute({ type: "team.create", name: "Rift Walkers", commandId: "team:create:2" }, auth());
    const team = Object.values(world.snapshot().teams)[0]!;
    world.execute({ type: "team.event.schedule", teamId: team.id, startsAt: "2026-07-21T12:00:00.000Z", endsAt: "2026-07-21T13:00:00.000Z", commandId: "team:event:1" }, auth());
    const event = world.snapshot().teams[team.id]!.events?.[0]!;
    world.execute({ type: "team.squad.assemble", teamId: team.id, eventId: event.id, playerIds: ["player:captain"], commandId: "team:squad:1" }, auth());
    world.execute({ type: "social.report", subjectId: "player:bad", reason: "harassment", commandId: "social:report:1" }, auth());
    assert.equal(world.events().at(-1)?.kind, "social.abuse_reported");
  });
});
