import { NextRequest, NextResponse } from "next/server";
import { addWildsGroupRoomMembers, appendWildsDirectMessage, appendWildsGroupMessage, createWildsGroupRoom } from "@/features/play/wilds-messenger-ledger";
import { normalizeWildsMessengerParticipant, type WildsMessengerParticipant } from "@/features/play/wilds-messenger-core";
import { hydrateWildsGroupRoom, publishWildsConversation, publishWildsGroupRoom } from "@/lib/receiz/wilds-messenger-server";
import { resolveWildsMultiplayerActor } from "@/lib/receiz/wilds-multiplayer-server";

function membersFrom(value: unknown) {
  if (!Array.isArray(value)) throw new Error("wilds_group_room_members_invalid");
  return value.slice(0, 23).map((member) => normalizeWildsMessengerParticipant(member as WildsMessengerParticipant));
}

function errorResponse(cause: unknown) {
  const error = cause instanceof Error ? cause.message : "wilds_group_room_failed";
  return NextResponse.json({ ok: false, error }, { status: error.includes("required") || error.includes("invalid") ? 400 : 503, headers: { "cache-control": "private, no-store" } });
}

export async function GET(request: NextRequest) {
  try {
    const actor = await resolveWildsMultiplayerActor(request, request.nextUrl.searchParams.get("guestId"));
    const ids = (request.nextUrl.searchParams.get("ids") ?? "").split(",").filter((id) => /^group-room:[a-f0-9]{32}$/.test(id)).slice(0, 40);
    const rooms = (await Promise.all(ids.map((id) => hydrateWildsGroupRoom(request, actor, id).catch(() => null)))).filter(Boolean);
    return NextResponse.json({ ok: true, rooms }, { headers: { "cache-control": "private, no-store" } });
  } catch (cause) { return errorResponse(cause); }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json() as Record<string, unknown>;
    const actor = await resolveWildsMultiplayerActor(request, body.guestId);
    const self = { id: actor.playerId, handle: actor.handle };
    const action = body.action;
    let room;
    let invitedMembers: WildsMessengerParticipant[] = [];
    if (action === "create") {
      const members = membersFrom(body.members);
      room = createWildsGroupRoom({ owner: self, members, name: String(body.name ?? ""), clientRoomId: String(body.clientRoomId ?? "") });
      invitedMembers = room.members.filter((member) => member.id !== actor.playerId);
    } else {
      const roomId = String(body.roomId ?? "");
      room = await hydrateWildsGroupRoom(request, actor, roomId);
      if (action === "send") room = appendWildsGroupMessage({ roomId, sender: self, body: String(body.message ?? ""), clientMessageId: String(body.clientMessageId ?? "") });
      else if (action === "add-members") {
        const priorIds = new Set(room.members.map((member) => member.id));
        room = addWildsGroupRoomMembers({ roomId, actorId: actor.playerId, members: membersFrom(body.members) });
        invitedMembers = room.members.filter((member) => !priorIds.has(member.id));
      }
      else throw new Error("wilds_group_room_action_invalid");
    }
    await Promise.all(invitedMembers.map(async (member) => {
      const invite = appendWildsDirectMessage({ sender: self, recipient: member, body: `Added you to ${room.name}`, clientMessageId: `group-invite:${room.id}:${member.id}`, context: { kind: "group-invite", roomId: room.id, roomName: room.name } }).conversation;
      await publishWildsConversation(request, actor, invite);
    }));
    const publication = await publishWildsGroupRoom(request, actor, room);
    return NextResponse.json({ ok: true, room, publication }, { headers: { "cache-control": "private, no-store" } });
  } catch (cause) { return errorResponse(cause); }
}
