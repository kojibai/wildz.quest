import type { PvpCard } from "./pvp-battle-engine";

export type WildsChallengeState = "offered" | "accepted" | "active" | "settled" | "declined" | "expired" | "cancelled" | "void";

export type WildsChallenge = {
  id: string;
  roomKey: string;
  challengerId: string;
  opponentId: string;
  challengerCard: PvpCard;
  opponentCard: PvpCard | null;
  mode: "friendly" | "card_stake";
  state: WildsChallengeState;
  revision: number;
  offeredAt: string;
  acceptedAt: string | null;
  closedAt: string | null;
  expiresAt: string;
};

export function createFriendlyChallenge(input: {
  id: string;
  roomKey: string;
  challengerId: string;
  opponentId: string;
  challengerCard: PvpCard;
  offeredAt: string;
}) : WildsChallenge {
  if (input.challengerId === input.opponentId) throw new Error("wilds_challenge_self_invalid");
  return {
    ...input,
    opponentCard: null,
    mode: "friendly",
    state: "offered",
    revision: 1,
    acceptedAt: null,
    closedAt: null,
    expiresAt: new Date(Date.parse(input.offeredAt) + 45_000).toISOString()
  };
}

function assertOffered(challenge: WildsChallenge, actorId: string, now: string) {
  if (challenge.state !== "offered") throw new Error("wilds_challenge_transition_invalid");
  if (challenge.opponentId !== actorId) throw new Error("wilds_challenge_actor_invalid");
  if (Date.parse(now) > Date.parse(challenge.expiresAt)) throw new Error("wilds_challenge_expired");
}

export function acceptChallenge(challenge: WildsChallenge, actorId: string, opponentCard: PvpCard, acceptedAt: string): WildsChallenge {
  assertOffered(challenge, actorId, acceptedAt);
  return { ...challenge, opponentCard, state: "accepted", acceptedAt, revision: challenge.revision + 1 };
}

export function declineChallenge(challenge: WildsChallenge, actorId: string, declinedAt: string): WildsChallenge {
  assertOffered(challenge, actorId, declinedAt);
  return { ...challenge, state: "declined", closedAt: declinedAt, revision: challenge.revision + 1 };
}

export function cancelChallenge(challenge: WildsChallenge, actorId: string, cancelledAt: string): WildsChallenge {
  if (challenge.state !== "offered" || challenge.challengerId !== actorId) throw new Error("wilds_challenge_transition_invalid");
  return { ...challenge, state: "cancelled", closedAt: cancelledAt, revision: challenge.revision + 1 };
}
