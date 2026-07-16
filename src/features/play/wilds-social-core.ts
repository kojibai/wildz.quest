import { sha256PortableBasis } from "./portable-card";

export type WildsSocialRole = "captain" | "officer" | "member";
export type WildsSocialMember = { playerId: string; role: WildsSocialRole; joinedAt: string };
export type WildsSocialInvite = {
  id: string; teamId: string; inviterId: string; inviteeId: string;
  status: "pending" | "accepted" | "declined" | "expired";
  createdAt: string; expiresAt: string;
};
export type WildsSocialEvent = {
  id: string; organizerId: string; startsAt: string; endsAt: string; squadPlayerIds: string[];
};
export type WildsSocialTeam = {
  id: string; name: string; captainId: string; members: WildsSocialMember[];
  invites: WildsSocialInvite[]; events: WildsSocialEvent[];
};

const idValid = (value: string) => typeof value === "string" && /^[a-z0-9][a-z0-9:._-]{2,179}$/i.test(value);
const iso = (value: string) => { const time = Date.parse(value); if (!Number.isFinite(time)) throw new Error("wilds_social_time_invalid"); return new Date(time).toISOString(); };
const teamName = (value: string) => { const clean = value.normalize("NFKC").replace(/[^a-z0-9 '\-]/gi, "").replace(/\s+/g, " ").trim(); if (clean.length < 3 || clean.length > 40) throw new Error("wilds_social_name_invalid"); return clean; };

export function createWildsSocialTeam(input: { captainId: string; name: string; occurredAt: string }): WildsSocialTeam {
  if (!idValid(input.captainId)) throw new Error("wilds_social_captain_invalid");
  const createdAt = iso(input.occurredAt); const name = teamName(input.name);
  const digest = sha256PortableBasis(`wilds:social:v3:${input.captainId}:${name.toLowerCase()}:${createdAt}`);
  return { id: `team:${digest.slice(7, 31)}`, name, captainId: input.captainId, members: [{ playerId: input.captainId, role: "captain", joinedAt: createdAt }], invites: [], events: [] };
}

function authorized(team: WildsSocialTeam, playerId: string) {
  const member = team.members.find((entry) => entry.playerId === playerId);
  if (!member || (member.role !== "captain" && member.role !== "officer")) throw new Error("wilds_social_inviter_forbidden");
}

export function inviteWildsPlayer(input: { team: WildsSocialTeam; inviterId: string; inviteeId: string; occurredAt: string; expiresAt: string; inviteeAccountAgeDays?: number }) {
  const createdAt = iso(input.occurredAt); const expiresAt = iso(input.expiresAt);
  if (!idValid(input.inviteeId) || !idValid(input.inviterId)) throw new Error("wilds_social_player_invalid");
  authorized(input.team, input.inviterId);
  if (input.inviteeAccountAgeDays !== undefined && input.inviteeAccountAgeDays < 1) throw new Error("wilds_social_new_player_protected");
  if (input.team.members.some((member) => member.playerId === input.inviteeId)) throw new Error("wilds_social_member_exists");
  if (input.team.invites.some((invite) => invite.inviteeId === input.inviteeId && invite.status === "pending" && Date.parse(invite.expiresAt) > Date.parse(createdAt))) throw new Error("wilds_social_invite_duplicate");
  const digest = sha256PortableBasis(`wilds:invite:${input.team.id}:${input.inviterId}:${input.inviteeId}:${createdAt}`);
  const invite: WildsSocialInvite = { id: `invite:${digest.slice(7, 31)}`, teamId: input.team.id, inviterId: input.inviterId, inviteeId: input.inviteeId, status: "pending", createdAt, expiresAt };
  return { team: { ...input.team, invites: [...input.team.invites, invite] }, invite };
}

export function acceptWildsInvite(input: { team: WildsSocialTeam; inviteId: string; playerId: string; occurredAt: string }) {
  const now = iso(input.occurredAt); const invite = input.team.invites.find((entry) => entry.id === input.inviteId);
  if (!invite || invite.inviteeId !== input.playerId) throw new Error("wilds_social_invite_invalid");
  if (invite.status !== "pending") throw new Error("wilds_social_invite_unavailable");
  if (Date.parse(invite.expiresAt) <= Date.parse(now)) throw new Error("wilds_social_invite_expired");
  if (input.team.members.length >= 24) throw new Error("wilds_social_team_full");
  const invites = input.team.invites.map((entry) => entry.id === invite.id ? { ...entry, status: "accepted" as const } : entry);
  return { team: { ...input.team, invites, members: [...input.team.members, { playerId: input.playerId, role: "member" as const, joinedAt: now }] } };
}

export function changeWildsRole(input: { team: WildsSocialTeam; actorId: string; playerId: string; role: WildsSocialRole }) {
  if (input.actorId !== input.team.captainId) throw new Error("wilds_social_role_forbidden");
  const member = input.team.members.find((entry) => entry.playerId === input.playerId);
  if (!member) throw new Error("wilds_social_member_missing");
  if (input.playerId === input.team.captainId && input.role !== "captain") throw new Error("wilds_social_captain_required");
  const members = input.team.members.map((entry) => {
    if (entry.playerId === input.playerId) return { ...entry, role: input.role };
    if (input.role === "captain" && entry.playerId === input.team.captainId) return { ...entry, role: "officer" as const };
    return entry;
  });
  return { team: { ...input.team, captainId: input.role === "captain" ? input.playerId : input.team.captainId, members } };
}

export function scheduleWildsTeamEvent(input: { team: WildsSocialTeam; organizerId: string; startsAt: string; endsAt: string; occurredAt: string }) {
  const startsAt = iso(input.startsAt); const endsAt = iso(input.endsAt); iso(input.occurredAt);
  authorized(input.team, input.organizerId);
  if (Date.parse(endsAt) <= Date.parse(startsAt)) throw new Error("wilds_social_schedule_invalid");
  if (input.team.events.some((event) => Date.parse(startsAt) < Date.parse(event.endsAt) && Date.parse(endsAt) > Date.parse(event.startsAt))) throw new Error("wilds_social_schedule_conflict");
  const digest = sha256PortableBasis(`wilds:event:${input.team.id}:${startsAt}:${endsAt}`);
  const event: WildsSocialEvent = { id: `event:${digest.slice(7, 31)}`, organizerId: input.organizerId, startsAt, endsAt, squadPlayerIds: [] };
  return { team: { ...input.team, events: [...input.team.events, event] }, event };
}

export function assembleWildsSquad(input: { team: WildsSocialTeam; eventId: string; playerIds: string[] }) {
  const event = input.team.events.find((entry) => entry.id === input.eventId); if (!event) throw new Error("wilds_social_event_invalid");
  if (new Set(input.playerIds).size !== input.playerIds.length) throw new Error("wilds_social_squad_cap");
  if (input.playerIds.some((playerId) => !input.team.members.some((member) => member.playerId === playerId))) throw new Error("wilds_social_squad_member_invalid");
  const updated = { ...event, squadPlayerIds: [...input.playerIds].slice(0, 6) };
  return { team: { ...input.team, events: input.team.events.map((entry) => entry.id === event.id ? updated : entry) }, event: updated };
}

const abuseReports = new Set<string>();
export function reportWildsAbuse(input: { reporterId: string; subjectId: string; reason: string; occurredAt: string }) {
  iso(input.occurredAt); if (!idValid(input.reporterId) || !idValid(input.subjectId)) throw new Error("wilds_social_report_invalid");
  const reason = input.reason.trim().slice(0, 280); if (!reason) throw new Error("wilds_social_report_invalid");
  const key = `${input.reporterId}:${input.subjectId}:${reason.toLowerCase()}`; if (abuseReports.has(key)) throw new Error("wilds_social_report_duplicate"); abuseReports.add(key);
  return { id: `report:${sha256PortableBasis(`wilds:report:${key}`).slice(7, 31)}`, status: "queued" as const };
}
