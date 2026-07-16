import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  assembleWildsSquad,
  acceptWildsInvite,
  createWildsSocialTeam,
  inviteWildsPlayer,
  scheduleWildsTeamEvent,
  reportWildsAbuse,
  type WildsSocialTeam
} from "../src/features/play/wilds-social-core.js";

const at = "2026-07-20T12:00:00.000Z";
function teamFixture(): WildsSocialTeam {
  return createWildsSocialTeam({ captainId: "player:captain", name: "Rift Walkers", occurredAt: at });
}

describe("Slice 5 social core", () => {
  it("persists captain/officer/member roles and accepts an expiring invite", () => {
    let team = teamFixture();
    const invite = inviteWildsPlayer({ team, inviterId: "player:captain", inviteeId: "player:friend", occurredAt: at, expiresAt: "2026-07-21T12:00:00.000Z" });
    team = acceptWildsInvite({ team: invite.team, inviteId: invite.invite.id, playerId: "player:friend", occurredAt: at }).team;
    assert.equal(team.members.find((member) => member.playerId === "player:captain")?.role, "captain");
    assert.equal(team.members.find((member) => member.playerId === "player:friend")?.role, "member");
    assert.throws(() => inviteWildsPlayer({ team, inviterId: "player:friend", inviteeId: "player:other", occurredAt: at, expiresAt: "2026-07-21T12:00:00.000Z" }), /wilds_social_inviter_forbidden/);
  });

  it("rejects expired invites and prevents duplicate/pending spam", () => {
    const team = teamFixture();
    const invite = inviteWildsPlayer({ team, inviterId: "player:captain", inviteeId: "player:new", occurredAt: at, expiresAt: "2026-07-19T12:00:00.000Z" });
    assert.throws(() => acceptWildsInvite({ team: invite.team, inviteId: invite.invite.id, playerId: "player:new", occurredAt: at }), /wilds_social_invite_expired/);
    const pending = inviteWildsPlayer({ team, inviterId: "player:captain", inviteeId: "player:new", occurredAt: at, expiresAt: "2026-07-21T12:00:00.000Z" });
    assert.throws(() => inviteWildsPlayer({ team: pending.team, inviterId: "player:captain", inviteeId: "player:new", occurredAt: at, expiresAt: "2026-07-22T12:00:00.000Z" }), /wilds_social_invite_duplicate/);
  });

  it("schedules non-overlapping events and assembles at most six eligible players", () => {
    let team = teamFixture();
    const first = scheduleWildsTeamEvent({ team, organizerId: "player:captain", startsAt: "2026-07-21T12:00:00.000Z", endsAt: "2026-07-21T13:00:00.000Z", occurredAt: at });
    team = first.team;
    assert.throws(() => scheduleWildsTeamEvent({ team, organizerId: "player:captain", startsAt: "2026-07-21T12:30:00.000Z", endsAt: "2026-07-21T13:30:00.000Z", occurredAt: at }), /wilds_social_schedule_conflict/);
    for (let index = 0; index < 6; index += 1) team = inviteWildsPlayer({ team, inviterId: "player:captain", inviteeId: `player:${index}`, occurredAt: at, expiresAt: "2026-07-30T00:00:00.000Z" }).team;
    for (let index = 0; index < 6; index += 1) team = acceptWildsInvite({ team, inviteId: team.invites[index]!.id, playerId: `player:${index}`, occurredAt: at }).team;
    const squad = assembleWildsSquad({ team, eventId: first.event.id, playerIds: ["player:captain", ...Array.from({ length: 6 }, (_, index) => `player:${index}`)] });
    assert.equal(squad.event.squadPlayerIds.length, 6);
    assert.equal(new Set(squad.event.squadPlayerIds).size, 6);
  });

  it("protects new players and rate-limits abuse reports", () => {
    const team = teamFixture();
    assert.throws(() => inviteWildsPlayer({ team, inviterId: "player:captain", inviteeId: "player:new", occurredAt: at, expiresAt: "2026-07-21T12:00:00.000Z", inviteeAccountAgeDays: 0 }), /wilds_social_new_player_protected/);
    const report = reportWildsAbuse({ reporterId: "player:captain", subjectId: "player:bad", reason: "harassment", occurredAt: at });
    assert.equal(report.status, "queued");
    assert.throws(() => reportWildsAbuse({ reporterId: "player:captain", subjectId: "player:bad", reason: "harassment", occurredAt: at }), /wilds_social_report_duplicate/);
  });
});
